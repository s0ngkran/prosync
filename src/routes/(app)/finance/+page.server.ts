import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	dikaVouchers,
	vendors,
	plans,
	bankAccounts,
	bankTransactions,
	taxTransactions,
	fiscalYears,
	agencies,
	provinces,
	bank,
	loans
} from '$lib/server/db/schema';
import { eq, or, and, isNull } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/db/audit';
import { createNotification, markReadByDocument } from '$lib/server/notifications';
import { users, orgUnits, documents, workflowSteps } from '$lib/server/db/schema';
import { approveDikaSchema, createBankAccountSchema, createLoanSchema, approveLoanSchema, repayLoanSchema, parseFormData } from '$lib/server/validation/schemas';
import { getAgencyScope } from '$lib/server/auth/scope';

interface DikaRow {
	id: number;
	document_id: number;
	vendor_name: string;
	vendor_tax_id: string;
	plan_title: string;
	fiscal_year_id: number;
	gross_amount: string;
	fine_amount: string;
	tax_amount: string;
	net_amount: string;
	status: string;
	payment_bank_account_id: number;
	tax_pool_account_id: number | null;
}

interface BankAccountRow {
	id: number;
	account_name: string;
	account_number: string;
	balance: string;
	is_tax_pool: boolean;
	bank_name: string;
	bank_code: string;
	bank_logo: string | null;
}

export const load: PageServerLoad = async ({ parent, url, cookies }) => {
	const { user } = await parent();

	const agencyId = getAgencyScope(user, cookies);

	// Load all vendors with type name
	const { vendorTypes } = await import('$lib/server/db/schema');
	let vendorTypeList: { id: number; name: string }[] = [];
	let vendorList: any[] = [];
	try {
		vendorTypeList = await db.select().from(vendorTypes).orderBy(vendorTypes.name);
		vendorList = await db
			.select({
				id: vendors.id,
				vendor_type_id: vendors.vendor_type_id,
				vendor_type: vendors.vendor_type,
				vendor_type_name: vendorTypes.name,
				tax_id: vendors.tax_id,
				company_name: vendors.company_name,
				contact_person: vendors.contact_person,
				contact_email: vendors.contact_email,
				contact_phone: vendors.contact_phone
			})
			.from(vendors)
			.leftJoin(vendorTypes, eq(vendors.vendor_type_id, vendorTypes.id));
	} catch {
		// Fallback if vendor_types table doesn't exist yet
		vendorList = await db.select().from(vendors);
	}

	let dikaList: DikaRow[] = [];
	let accountList: BankAccountRow[] = [];
	let taxList: any[] = [];
	let loanList: typeof loans.$inferSelect[] = [];
	let fyList: { id: number; year_name: string; is_active: boolean }[] = [];

	if (agencyId) {
		fyList = await db
			.select({ id: fiscalYears.id, year_name: fiscalYears.year_name, is_active: fiscalYears.is_active })
			.from(fiscalYears)
			.where(eq(fiscalYears.agency_id, agencyId));
		dikaList = await db
			.select({
				id: dikaVouchers.id,
				document_id: dikaVouchers.document_id,
				vendor_name: vendors.company_name,
				vendor_tax_id: vendors.tax_id,
				plan_title: plans.title,
				fiscal_year_id: plans.fiscal_year_id,
				gross_amount: dikaVouchers.gross_amount,
				fine_amount: dikaVouchers.fine_amount,
				tax_amount: dikaVouchers.tax_amount,
				net_amount: dikaVouchers.net_amount,
				status: dikaVouchers.status,
				payment_bank_account_id: dikaVouchers.payment_bank_account_id,
				tax_pool_account_id: dikaVouchers.tax_pool_account_id
			})
			.from(dikaVouchers)
			.innerJoin(vendors, eq(dikaVouchers.vendor_id, vendors.id))
			.innerJoin(plans, eq(dikaVouchers.plan_id, plans.id))
			.where(eq(dikaVouchers.agency_id, agencyId));

		accountList = await db
			.select({
				id: bankAccounts.id,
				account_name: bankAccounts.account_name,
				account_number: bankAccounts.account_number,
				balance: bankAccounts.balance,
				is_tax_pool: bankAccounts.is_tax_pool,
				bank_name: bank.name,
				bank_code: bank.bank_code,
				bank_logo: bank.logo_url
			})
			.from(bankAccounts)
			.innerJoin(bank, eq(bankAccounts.bank_id, bank.id))
			.where(eq(bankAccounts.agency_id, agencyId));

		taxList = await db
			.select({
				id: taxTransactions.id,
				agency_id: taxTransactions.agency_id,
				dika_voucher_id: taxTransactions.dika_voucher_id,
				vendor_id: taxTransactions.vendor_id,
				tax_id: taxTransactions.tax_id,
				tax_rate: taxTransactions.tax_rate,
				tax_base_amount: taxTransactions.tax_base_amount,
				tax_amount: taxTransactions.tax_amount,
				tax_form_type: taxTransactions.tax_form_type,
				status: taxTransactions.status,
				fiscal_year_id: plans.fiscal_year_id
			})
			.from(taxTransactions)
			.innerJoin(dikaVouchers, eq(taxTransactions.dika_voucher_id, dikaVouchers.id))
			.innerJoin(plans, eq(dikaVouchers.plan_id, plans.id))
			.where(eq(taxTransactions.agency_id, agencyId));

		loanList = await db
			.select()
			.from(loans)
			.where(or(eq(loans.borrower_agency_id, agencyId), eq(loans.lender_agency_id, agencyId)));
	}

	// Load bank list for account creation dropdown
	const bankList = await db.select({ id: bank.id, name: bank.name, bank_code: bank.bank_code, logo_url: bank.logo_url }).from(bank);

	// Load all agencies for inter-agency loan selector
	const allAgencies = await db.select({ id: agencies.id, name: agencies.name }).from(agencies);

	return {
		user,
		dikaVouchers: dikaList,
		bankAccounts: accountList,
		taxTransactions: taxList,
		loans: loanList,
		vendors: vendorList,
		vendorTypes: vendorTypeList,
		banks: bankList,
		fiscalYears: fyList,
		allAgencies,
		provinces: [] as { id: number; name: string }[],
		agencies: [] as any[],
		selectedProvinceId: null as number | null,
		selectedAgencyId: agencyId
	};
};

export const actions: Actions = {
	// ── กระบวนการฎีกาเบิกจ่าย 4 ขั้นตอน ──
	// Status flow: PENDING_EXAMINE → EXAMINED → APPROVED → PAID
	// PENDING_EXAMINE: วางฎีกาแล้ว รอตรวจสอบ (เจ้าหน้าที่บัญชี/แผนกการเงิน)
	// EXAMINED: ตรวจสอบแล้ว รออนุมัติ (ผอ./รองผอ.)
	// APPROVED: อนุมัติแล้ว รอจ่ายเงิน (หัวหน้าแผนกการเงิน)
	// PAID: จ่ายเงินแล้ว เสร็จสมบูรณ์
	approveDika: async ({ request, locals, getClientAddress }) => {
		const parsed = parseFormData(approveDikaSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { dika_id, action } = parsed.data;
			const [dika] = await db.select().from(dikaVouchers).where(eq(dikaVouchers.id, dika_id));
			if (!dika) return fail(404, { success: false, errors: { dika_id: ['ไม่พบฎีกา'] } });

			// Helper: find director (root org unit head) for this agency
			const findDirector = async (agencyId: number) => {
				const [rootUnit] = await db.select({ head_of_unit_id: orgUnits.head_of_unit_id })
					.from(orgUnits).where(and(eq(orgUnits.agency_id, agencyId), isNull(orgUnits.parent_id)));
				return rootUnit?.head_of_unit_id || null;
			};

			// Helper: find finance unit head
			const findFinanceHead = async (agencyId: number) => {
				const units = await db.select({ id: orgUnits.id, name: orgUnits.name, head_of_unit_id: orgUnits.head_of_unit_id })
					.from(orgUnits).where(eq(orgUnits.agency_id, agencyId));
				const finUnit = units.find((u) => u.name.includes('การเงิน') || u.name.includes('คลัง'));
				return finUnit?.head_of_unit_id || null;
			};

			// Resolve names for audit log
			const [agencyRow] = await db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, dika.agency_id));
			const [planRow] = dika.plan_id ? await db.select({ title: plans.title }).from(plans).where(eq(plans.id, dika.plan_id)) : [null];
			const [vendorRow] = dika.vendor_id ? await db.select({ company_name: vendors.company_name }).from(vendors).where(eq(vendors.id, dika.vendor_id)) : [null];
			const auditNames = {
				agency_name: agencyRow?.name || '',
				plan_name: planRow?.title || '',
				vendor_name: vendorRow?.company_name || ''
			};

			// Mark current user's notifications for this document as read
			if (dika.document_id) {
				await markReadByDocument(locals.user!.sub, dika.document_id);
			}

			// ขั้นตอนที่ 2: ตรวจสอบฎีกาและเอกสารประกอบ
			if (action === 'examine') {
				await db.update(dikaVouchers)
					.set({ status: 'EXAMINED', examiner_id: locals.user!.sub })
					.where(eq(dikaVouchers.id, dika_id));

				// แจ้ง ผอ. ให้อนุมัติ
				const directorId = await findDirector(dika.agency_id);
				if (directorId) {
					await createNotification({
						userId: directorId,
						documentId: dika.document_id,
						title: 'ฎีการออนุมัติเบิกจ่าย',
						message: `ฎีกา #${dika_id} ผ่านการตรวจสอบแล้ว — กรุณาอนุมัติการเบิกจ่าย (${dika.net_amount} บาท)`,
						actionUrl: '/finance',
						notificationType: 'APPROVAL_REQUIRED'
					});
				}
				await writeAuditLog({
						collection: 'bank_transaction_histories',
						action_type: 'DIKA_EXAMINED',
						agency_id: dika.agency_id,
						...auditNames,
						dika_voucher_id: dika_id,
						document_id: dika.document_id,
						net_amount: dika.net_amount,
						action_by: { user_id: locals.user!.sub, name: locals.user!.name, ip_address: getClientAddress() }
					});
					return { success: true, message: 'ตรวจสอบฎีกาสำเร็จ — ส่งต่อรออนุมัติ' };
			}

			// ขั้นตอนที่ 3: อนุมัติการเบิกจ่าย
			if (action === 'approve') {
				await db.update(dikaVouchers)
					.set({ status: 'APPROVED', director_id: locals.user!.sub })
					.where(eq(dikaVouchers.id, dika_id));

				// แจ้งหัวหน้าการเงินให้จ่ายเงิน
				const finHeadId = await findFinanceHead(dika.agency_id);
				if (finHeadId) {
					await createNotification({
						userId: finHeadId,
						documentId: dika.document_id,
						title: 'ฎีการอจ่ายเงิน',
						message: `ฎีกา #${dika_id} ได้รับอนุมัติแล้ว — กรุณาดำเนินการจ่ายเงินและตัดบัญชี (${dika.net_amount} บาท)`,
						actionUrl: '/finance',
						notificationType: 'APPROVAL_REQUIRED'
					});
				}
				await writeAuditLog({
						collection: 'bank_transaction_histories',
						action_type: 'DIKA_APPROVED',
						agency_id: dika.agency_id,
						...auditNames,
						dika_voucher_id: dika_id,
						document_id: dika.document_id,
						net_amount: dika.net_amount,
						action_by: { user_id: locals.user!.sub, name: locals.user!.name, ip_address: getClientAddress() }
					});
					return { success: true, message: 'อนุมัติการเบิกจ่ายสำเร็จ — ส่งต่อรอจ่ายเงิน' };
			}

			// ขั้นตอนที่ 4: จ่ายเงิน หักภาษี ตัดบัญชี
			if (action === 'pay') {
				const formData = await request.formData().catch(() => null);
				// Allow selecting payment/tax accounts (use form data or default from dika)
				const paymentAccountId = formData?.get('payment_bank_account_id')
					? Number(formData.get('payment_bank_account_id'))
					: dika.payment_bank_account_id;
				const taxPoolAccountId = formData?.get('tax_pool_account_id')
					? Number(formData.get('tax_pool_account_id'))
					: dika.tax_pool_account_id;

				await db.transaction(async (tx) => {
					await tx.update(dikaVouchers)
						.set({
							status: 'PAID',
							payment_bank_account_id: paymentAccountId,
							tax_pool_account_id: taxPoolAccountId
						})
						.where(eq(dikaVouchers.id, dika_id));

					// ตัดบัญชีจ่ายเงิน
					await tx.insert(bankTransactions).values({
						bank_account_id: paymentAccountId,
						transaction_type: 'OUT',
						amount: dika.net_amount,
						plan_id: dika.plan_id,
						dika_voucher_id: dika_id,
						action_by_user_id: locals.user!.sub,
						tags: { vendor_id: dika.vendor_id }
					});

					// หักภาษี ณ ที่จ่าย (ถ้ามี)
					if (Number(dika.tax_amount) > 0 && taxPoolAccountId) {
						await tx.insert(bankTransactions).values({
							bank_account_id: taxPoolAccountId,
							transaction_type: 'BORROW_TAX',
							amount: dika.tax_amount,
							plan_id: dika.plan_id,
							dika_voucher_id: dika_id,
							action_by_user_id: locals.user!.sub,
							tags: { type: 'tax_withholding' }
						});

						const [vendor] = await tx.select().from(vendors).where(eq(vendors.id, dika.vendor_id));
						await tx.insert(taxTransactions).values({
							agency_id: dika.agency_id,
							dika_voucher_id: dika_id,
							vendor_id: dika.vendor_id,
							tax_id: vendor?.tax_id || '',
							tax_rate: '1.00',
							tax_base_amount: dika.gross_amount,
							tax_amount: dika.tax_amount,
							tax_form_type: 'ภ.ง.ด.53',
							status: 'WITHHELD'
						});
					}
				});

				if (locals.user) {
					await writeAuditLog({
						collection: 'bank_transaction_histories',
						action_type: 'SYSTEM_SETTLE',
						agency_id: dika.agency_id,
						...auditNames,
						bank_transaction_id: dika_id,
						amount_change: { old: 0, new: Number(dika.net_amount) },
						action_by: {
							user_id: locals.user.sub,
							name: locals.user.name,
							ip_address: getClientAddress()
						}
					});
				}

				// แจ้งผู้สร้างเอกสารว่าจ่ายเงินเสร็จ
				if (dika.document_id) {
					const [doc] = await db.select({ updated_by: documents.updated_by }).from(documents).where(eq(documents.id, dika.document_id));
					if (doc?.updated_by) {
						await createNotification({
							userId: doc.updated_by,
							documentId: dika.document_id,
							title: 'จ่ายเงินเสร็จสมบูรณ์',
							message: `ฎีกา #${dika_id} จ่ายเงินและตัดบัญชีเรียบร้อยแล้ว (${dika.net_amount} บาท)`,
							actionUrl: '/finance',
							notificationType: 'UPLOAD_REQUIRED'
						});
					}
				}

				// Auto-complete the final procurement step ("รอการเงินเบิกจ่าย")
				if (dika.document_id) {
					const [procDoc] = await db.select().from(documents).where(eq(documents.id, dika.document_id));
					if (procDoc && procDoc.status === 'IN_PROGRESS') {
						const steps = await db.select().from(workflowSteps)
							.where(eq(workflowSteps.workflow_id, procDoc.workflow_id))
							.orderBy(workflowSteps.step_sequence);
						const finalStep = steps.find((s) => s.is_final_step);
						// Only auto-complete if doc is on the waiting-for-finance step
						if (finalStep && procDoc.current_step_id === finalStep.id) {
							const stepKey = `step_${finalStep.step_sequence}_${finalStep.step_name.replace(/\s+/g, '_').substring(0, 30)}`;
							const updatedPayload = {
								...(typeof procDoc.payload === 'string' ? JSON.parse(procDoc.payload) : procDoc.payload) as Record<string, unknown>,
								[stepKey]: {
									_meta: 'เบิกจ่ายสำเร็จ — แผนกการเงินจ่ายเงินเรียบร้อยแล้ว',
									completed_at: new Date().toISOString(),
									completed_by: locals.user?.sub || null,
									completed_by_name: locals.user?.name || null,
									dika_voucher_id: dika_id
								}
							};
							await db.update(documents).set({
								payload: updatedPayload,
								status: 'APPROVED_PROCUREMENT'
							}).where(eq(documents.id, dika.document_id));
						}
					}
				}

				return { success: true, message: 'จ่ายเงิน หักภาษี และตัดบัญชีสำเร็จ' };
			}

			if (action === 'reject') {
				await db.update(dikaVouchers)
					.set({ status: 'REJECTED' })
					.where(eq(dikaVouchers.id, dika_id));

				// แจ้งผู้สร้างเอกสารว่าฎีกาถูกปฏิเสธ
				if (dika.document_id) {
					const [doc] = await db.select({ updated_by: documents.updated_by }).from(documents).where(eq(documents.id, dika.document_id));
					if (doc?.updated_by) {
						await createNotification({
							userId: doc.updated_by,
							documentId: dika.document_id,
							title: 'ฎีกาถูกปฏิเสธ',
							message: `ฎีกา #${dika_id} ถูกปฏิเสธ/คืนแก้ไข — กรุณาตรวจสอบและแก้ไข`,
							actionUrl: '/finance',
							notificationType: 'DOCUMENT_REJECTED'
						});
					}
				}

				await writeAuditLog({
						collection: 'bank_transaction_histories',
						action_type: 'DIKA_REJECTED',
						agency_id: dika.agency_id,
						...auditNames,
						dika_voucher_id: dika_id,
						document_id: dika.document_id,
						net_amount: dika.net_amount,
						action_by: { user_id: locals.user!.sub, name: locals.user!.name, ip_address: getClientAddress() }
					});

					return { success: true, message: 'ปฏิเสธฎีกาแล้ว' };
			}
		} catch (err) {
			console.error('Approve dika error:', err);
			return fail(500, { success: false, errors: { dika_id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	createBankAccount: async ({ request }) => {
		const parsed = parseFormData(createBankAccountSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			await db.insert(bankAccounts).values({
				...parsed.data,
				balance: '0'
			});

			return { success: true, message: 'สร้างบัญชีธนาคารสำเร็จ' };
		} catch (err) {
			console.error('Create bank account error:', err);
			return fail(500, { success: false, errors: { account_name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	createLoan: async ({ request, locals }) => {
		const parsed = parseFormData(createLoanSchema, await request.formData());
		if (!parsed.success) return fail(400, { success: false, errors: parsed.errors });
		try {
			const { amount, purpose, due_date, loan_type, borrower_agency_id, lender_agency_id, source_bank_account_id } = parsed.data;
			await db.insert(loans).values({
				borrower_agency_id,
				loan_type,
				lender_agency_id: lender_agency_id ?? null,
				source_bank_account_id: source_bank_account_id ?? null,
				amount: String(amount),
				purpose,
				due_date: due_date || null,
				requested_by_user_id: (locals as any).user?.id ?? null
			});
			return { success: true, message: 'สร้างคำขอยืมเงินสำเร็จ' };
		} catch (err) {
			console.error('Create loan error:', err);
			return fail(500, { success: false, errors: { amount: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	approveLoan: async ({ request, locals }) => {
		const parsed = parseFormData(approveLoanSchema, await request.formData());
		if (!parsed.success) return fail(400, { success: false, errors: parsed.errors });
		try {
			const { loan_id, action } = parsed.data;
			await db.update(loans).set({
				status: action === 'APPROVED' ? 'APPROVED' : 'REJECTED',
				approved_by_user_id: (locals as any).user?.id ?? null,
				approved_at: new Date()
			}).where(eq(loans.id, loan_id));
			return { success: true, message: action === 'APPROVED' ? 'อนุมัติการยืมเงินแล้ว' : 'ปฏิเสธการยืมเงินแล้ว' };
		} catch (err) {
			console.error('Approve loan error:', err);
			return fail(500, { success: false, errors: { loan_id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	repayLoan: async ({ request }) => {
		const parsed = parseFormData(repayLoanSchema, await request.formData());
		if (!parsed.success) return fail(400, { success: false, errors: parsed.errors });
		try {
			const { loan_id, repay_amount } = parsed.data;
			const [loan] = await db.select().from(loans).where(eq(loans.id, loan_id));
			if (!loan) return fail(404, { success: false, errors: { loan_id: ['ไม่พบรายการยืม'] } });
			const newRepaid = Number(loan.repaid_amount) + repay_amount;
			const fullyRepaid = newRepaid >= Number(loan.amount);
			await db.update(loans).set({
				repaid_amount: String(newRepaid),
				status: fullyRepaid ? 'REPAID' : loan.status,
				repaid_at: fullyRepaid ? new Date() : null
			}).where(eq(loans.id, loan_id));
			return { success: true, message: fullyRepaid ? 'ชำระคืนครบแล้ว' : 'บันทึกการชำระคืนแล้ว' };
		} catch (err) {
			console.error('Repay loan error:', err);
			return fail(500, { success: false, errors: { loan_id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	// ── Vendor Type CRUD ──
	createVendorType: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin && !locals.user?.is_director && !locals.user?.permissions.can_manage_finance) {
			return fail(403, { success: false, errors: { name: ['ไม่มีสิทธิ์'] } });
		}
		const form = await request.formData();
		const name = form.get('name')?.toString().trim();
		if (!name) return fail(400, { success: false, errors: { name: ['กรุณากรอกชื่อประเภท'] } });

		try {
			const { vendorTypes } = await import('$lib/server/db/schema');
			await db.insert(vendorTypes).values({ name });
			return { success: true, message: 'เพิ่มประเภทผู้ประกอบการสำเร็จ' };
		} catch (err) {
			console.error('Create vendor type error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด'] } });
		}
	},

	deleteVendorType: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) return fail(403, { success: false, errors: { id: ['ไม่มีสิทธิ์'] } });
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { success: false, errors: { id: ['ไม่พบประเภท'] } });

		try {
			const { vendorTypes } = await import('$lib/server/db/schema');
			await db.delete(vendorTypes).where(eq(vendorTypes.id, id));
			return { success: true, message: 'ลบประเภทสำเร็จ' };
		} catch (err) {
			console.error('Delete vendor type error:', err);
			return fail(500, { success: false, errors: { id: ['เกิดข้อผิดพลาด อาจมีผู้ประกอบการที่ใช้ประเภทนี้อยู่'] } });
		}
	},

	// ── Vendor CRUD ──
	createVendor: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin && !locals.user?.is_director && !locals.user?.permissions.can_manage_finance) {
			return fail(403, { success: false, errors: { company_name: ['ไม่มีสิทธิ์'] } });
		}
		const form = await request.formData();
		const company_name = form.get('company_name')?.toString().trim();
		const tax_id = form.get('tax_id')?.toString().trim();
		const vendor_type_id = form.get('vendor_type_id')?.toString();
		if (!company_name || !tax_id) return fail(400, { success: false, errors: { company_name: ['กรุณากรอกข้อมูลที่จำเป็น'] } });

		try {
			const { vendorTypes } = await import('$lib/server/db/schema');
			const vtId = vendor_type_id ? Number(vendor_type_id) : null;
			let vtName: string | null = null;
			if (vtId) {
				const [vt] = await db.select({ name: vendorTypes.name }).from(vendorTypes).where(eq(vendorTypes.id, vtId));
				vtName = vt?.name ?? null;
			}
			await db.insert(vendors).values({
				company_name,
				tax_id,
				vendor_type_id: vtId,
				vendor_type: vtName,
				contact_person: form.get('contact_person')?.toString().trim() || null,
				contact_email: form.get('contact_email')?.toString().trim() || null,
				contact_phone: form.get('contact_phone')?.toString().trim() || null
			});
			return { success: true, message: 'เพิ่มผู้ประกอบการสำเร็จ' };
		} catch (err: any) {
			if (err?.code === '23505') return fail(400, { success: false, errors: { tax_id: ['เลขผู้เสียภาษีซ้ำ'] } });
			console.error('Create vendor error:', err);
			return fail(500, { success: false, errors: { company_name: ['เกิดข้อผิดพลาด'] } });
		}
	},

	updateVendor: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin && !locals.user?.is_director && !locals.user?.permissions.can_manage_finance) {
			return fail(403, { success: false, errors: { company_name: ['ไม่มีสิทธิ์'] } });
		}
		const form = await request.formData();
		const id = Number(form.get('id'));
		const company_name = form.get('company_name')?.toString().trim();
		const vendor_type_id = form.get('vendor_type_id')?.toString();
		if (!id || !company_name) return fail(400, { success: false, errors: { company_name: ['ข้อมูลไม่ครบ'] } });

		try {
			const { vendorTypes } = await import('$lib/server/db/schema');
			const vtId = vendor_type_id ? Number(vendor_type_id) : null;
			let vtName: string | null = null;
			if (vtId) {
				const [vt] = await db.select({ name: vendorTypes.name }).from(vendorTypes).where(eq(vendorTypes.id, vtId));
				vtName = vt?.name ?? null;
			}
			await db.update(vendors).set({
				company_name,
				vendor_type_id: vtId,
				vendor_type: vtName,
				contact_person: form.get('contact_person')?.toString().trim() || null,
				contact_email: form.get('contact_email')?.toString().trim() || null,
				contact_phone: form.get('contact_phone')?.toString().trim() || null
			}).where(eq(vendors.id, id));
			return { success: true, message: 'แก้ไขผู้ประกอบการสำเร็จ' };
		} catch (err) {
			console.error('Update vendor error:', err);
			return fail(500, { success: false, errors: { company_name: ['เกิดข้อผิดพลาด'] } });
		}
	},

	importVendorCsv: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin && !locals.user?.is_director && !locals.user?.permissions.can_manage_finance) {
			return fail(403, { success: false, errors: { csv: ['ไม่มีสิทธิ์'] } });
		}

		const formData = await request.formData();
		const file = formData.get('csv_file') as File | null;
		if (!file || file.size === 0) return fail(400, { success: false, errors: { csv: ['กรุณาเลือกไฟล์ CSV'] } });

		try {
			const text = await file.text();
			const { parseCsv } = await import('$lib/utils/format');
			const rows = parseCsv(text);
			if (rows.length === 0) return fail(400, { success: false, errors: { csv: ['ไฟล์ CSV ว่างเปล่า'] } });

			const { vendorTypes } = await import('$lib/server/db/schema');
			let vtMap = new Map<string, number>();
			try {
				const allVt = await db.select().from(vendorTypes);
				vtMap = new Map(allVt.map((v) => [v.name.trim(), v.id]));
			} catch { /* vendor_types table may not exist yet */ }

			let created = 0;
			let skipped = 0;

			for (const row of rows) {
				const company_name = row['ชื่อบริษัท']?.trim();
				const tax_id = row['เลขผู้เสียภาษี']?.trim();
				if (!company_name || !tax_id) { skipped++; continue; }
				if (!/^\d{13}$/.test(tax_id)) { skipped++; continue; }

				// Check duplicate tax_id
				const [existing] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.tax_id, tax_id)).limit(1);
				if (existing) { skipped++; continue; }

				const typeName = row['ประเภท']?.trim();
				const vtId = typeName ? vtMap.get(typeName) ?? null : null;

				await db.insert(vendors).values({
					company_name,
					tax_id,
					vendor_type_id: vtId,
					vendor_type: typeName || null,
					contact_person: row['ผู้ติดต่อ']?.trim() || null,
					contact_phone: row['เบอร์โทร']?.trim() || null,
					contact_email: row['อีเมล']?.trim() || null
				});
				created++;
			}

			const msg = `นำเข้าสำเร็จ ${created} รายการ` + (skipped > 0 ? ` (ข้าม ${skipped} รายการ)` : '');
			return { success: true, message: msg };
		} catch (err) {
			console.error('Import vendor CSV error:', err);
			return fail(500, { success: false, errors: { csv: ['เกิดข้อผิดพลาดในการนำเข้า'] } });
		}
	},

	deleteVendor: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) return fail(403, { success: false, errors: { id: ['ไม่มีสิทธิ์'] } });
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { success: false, errors: { id: ['ไม่พบผู้ประกอบการ'] } });

		try {
			await db.delete(vendors).where(eq(vendors.id, id));
			return { success: true, message: 'ลบผู้ประกอบการสำเร็จ' };
		} catch (err) {
			console.error('Delete vendor error:', err);
			return fail(500, { success: false, errors: { id: ['เกิดข้อผิดพลาด อาจมีเอกสารที่อ้างอิงอยู่'] } });
		}
	}
};
