import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	documents,
	workflows,
	workflowSteps,
	plans,
	vendors,
	documentCommittees,
	documentBidders,
	approvals,
	dikaVouchers,
	users,
	bankAccounts,
	agencies
} from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/db/audit';
import {
	addCommitteeSchema,
	addBidderSchema,
	updateBidderScoreSchema,
	approveSchema,
	generateDikaSchema,
	parseFormData
} from '$lib/server/validation/schemas';
import { assignAndNotify, completeAssignment } from '$lib/server/step-assignments';
import { createNotification } from '$lib/server/notifications';

async function resolveDocId(slug: string): Promise<number> {
	const [row] = await db.select({ id: documents.id }).from(documents).where(eq(documents.slug, slug)).limit(1);
	if (!row) throw new Error('ไม่พบเอกสาร');
	return row.id;
}

export const load: PageServerLoad = async ({ params, parent }) => {
	const { user } = await parent();
	const docSlug = params.slug;

	const [doc] = await db
		.select({
			id: documents.id,
			slug: documents.slug,
			agency_id: documents.agency_id,
			workflow_id: documents.workflow_id,
			plan_id: documents.plan_id,
			current_step_id: documents.current_step_id,
			payload: documents.payload,
			status: documents.status,
			updated_by: documents.updated_by,
			doc_type: documents.doc_type,
			procurement_method: documents.procurement_method,
			phase: documents.phase
		})
		.from(documents)
		.where(eq(documents.slug, docSlug));

	if (!doc) throw error(404, 'ไม่พบเอกสาร');
	const docId = doc.id;

	// Check if this is a v2 document (has doc_type) or legacy
	const isV2 = !!doc.doc_type && doc.phase !== 'LEGACY';

	// For v2 documents, load approval steps and payment rounds
	let approvalSteps: any[] = [];
	let docPaymentRounds: any[] = [];
	let docProjectItems: any[] = [];
	if (isV2) {
		const { documentApprovalSteps, paymentRounds: paymentRoundsTable, projectItems } = await import('$lib/server/db/schema');
		approvalSteps = await db
			.select()
			.from(documentApprovalSteps)
			.where(eq(documentApprovalSteps.document_id, docId));
		docPaymentRounds = await db
			.select()
			.from(paymentRoundsTable)
			.where(eq(paymentRoundsTable.document_id, docId));
		if (doc.doc_type === 'type5_project') {
			docProjectItems = await db
				.select()
				.from(projectItems)
				.where(eq(projectItems.document_id, docId));
		}
	}

	// Legacy workflow data (only if workflow_id exists)
	let workflow = null;
	let steps: any[] = [];
	if (doc.workflow_id) {
		[workflow] = await db.select().from(workflows).where(eq(workflows.id, doc.workflow_id));
		steps = await db
			.select()
			.from(workflowSteps)
			.where(eq(workflowSteps.workflow_id, doc.workflow_id))
			.orderBy(workflowSteps.step_sequence);
	}

	const [plan] = await db.select().from(plans).where(eq(plans.id, doc.plan_id));

	const committees = await db
		.select({
			id: documentCommittees.id,
			user_id: documentCommittees.user_id,
			user_name: users.name,
			committee_type: documentCommittees.committee_type,
			role_in_committee: documentCommittees.role_in_committee
		})
		.from(documentCommittees)
		.innerJoin(users, eq(documentCommittees.user_id, users.id))
		.where(eq(documentCommittees.document_id, docId));

	const bidders = await db
		.select({
			id: documentBidders.id,
			vendor_id: documentBidders.vendor_id,
			vendor_name: vendors.company_name,
			proposal_pdf_url: documentBidders.proposal_pdf_url,
			proposed_price: documentBidders.proposed_price,
			score: documentBidders.score,
			is_winner: documentBidders.is_winner
		})
		.from(documentBidders)
		.innerJoin(vendors, eq(documentBidders.vendor_id, vendors.id))
		.where(eq(documentBidders.document_id, docId));

	const approvalList = await db
		.select({
			id: approvals.id,
			step_id: approvals.step_id,
			user_name: users.name,
			action: approvals.action,
			comment: approvals.comment,
			created_at: approvals.created_at
		})
		.from(approvals)
		.innerJoin(users, eq(approvals.user_id, users.id))
		.where(eq(approvals.document_id, docId));

	const vendorList = await db.select().from(vendors);
	const userList = await db
		.select({ id: users.id, name: users.name, position: users.position })
		.from(users)
		.where(eq(users.agency_id, doc.agency_id));

	const accounts = await db
		.select()
		.from(bankAccounts)
		.where(eq(bankAccounts.agency_id, doc.agency_id));

	// Fetch dika voucher for this document (if exists)
	const [dikaVoucher] = await db
		.select({
			id: dikaVouchers.id,
			status: dikaVouchers.status,
			gross_amount: dikaVouchers.gross_amount,
			net_amount: dikaVouchers.net_amount,
			tax_amount: dikaVouchers.tax_amount
		})
		.from(dikaVouchers)
		.where(eq(dikaVouchers.document_id, docId));

	const currentStep = steps.find((s) => s.id === doc.current_step_id);

	// Check if current user is assigned to the current step
	let isAssignedToCurrentStep = false;
	if (currentStep && user) {
		const { documentStepAssignments } = await import('$lib/server/db/schema');
		const [assignment] = await db
			.select({ id: documentStepAssignments.id })
			.from(documentStepAssignments)
			.where(and(
				eq(documentStepAssignments.document_id, docId),
				eq(documentStepAssignments.step_id, currentStep.id),
				eq(documentStepAssignments.user_id, user.sub),
				eq(documentStepAssignments.is_completed, false)
			))
			.limit(1);
		isAssignedToCurrentStep = !!assignment;
	}

	// Super admin and document creator can always act
	const isCreator = doc.updated_by === user.sub;
	const canActOnStep = user.is_super_admin || isAssignedToCurrentStep || isCreator;

	return {
		user,
		document: doc,
		workflow,
		steps,
		currentStep,
		plan,
		committees,
		bidders,
		approvals: approvalList,
		vendors: vendorList,
		users: userList,
		bankAccounts: accounts,
		canActOnStep,
		dikaVoucher: dikaVoucher || null,
		// v2 data
		isV2,
		approvalSteps,
		paymentRounds: docPaymentRounds,
		projectItems: docProjectItems
	};
};

export const actions: Actions = {
	advanceStep: async ({ request, params, locals, getClientAddress }) => {
		const form = await request.formData();
		const docId = await resolveDocId(params.slug);
		const stepData = form.get('step_data') as string | null;

		let parsedData: Record<string, unknown> = {};
		try {
			parsedData = stepData ? JSON.parse(stepData) as Record<string, unknown> : {};
		} catch {
			return fail(400, { success: false, errors: { step: ['ข้อมูลขั้นตอนไม่ถูกต้อง'] } });
		}

		// Handle file upload
		const pdfFile = form.get('pdf_file') as File | null;
		if (pdfFile && pdfFile.size > 0) {
			const { writeFileSync, mkdirSync, existsSync } = await import('fs');
			const { join } = await import('path');

			// Path pattern: /uploads/procurement/{agency_id}/{doc_id}/step_{seq}_{timestamp}.pdf
			const uploadDir = join('static', 'uploads', 'procurement', String(form.get('agency_id') || '0'), String(docId));
			if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

			const timestamp = Date.now();
			const filename = `step_${form.get('step_seq') || '0'}_${timestamp}.pdf`;
			const filePath = join(uploadDir, filename);
			const publicPath = `/uploads/procurement/${form.get('agency_id') || '0'}/${docId}/${filename}`;

			const buffer = Buffer.from(await pdfFile.arrayBuffer());
			writeFileSync(filePath, buffer);

			parsedData.uploaded_pdf = publicPath;
			parsedData.uploaded_filename = pdfFile.name;
			parsedData.uploaded_at = new Date().toISOString();
		}

		try {
			const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
			if (!doc) return fail(404, { success: false, errors: { step: ['ไม่พบเอกสาร'] } });

			const steps = await db
				.select()
				.from(workflowSteps)
				.where(eq(workflowSteps.workflow_id, doc.workflow_id))
				.orderBy(workflowSteps.step_sequence);

			const currentStep = steps.find((s) => s.id === doc.current_step_id);
			if (!currentStep) return fail(400, { success: false, errors: { step: ['ไม่พบขั้นตอนปัจจุบัน'] } });

			// Prevent manual advancement of waiting-for-finance steps
			if ((currentStep.ui_schema as any)?.type === 'waiting_for_finance') {
				return fail(400, { success: false, errors: { step: ['ขั้นตอนนี้จะเสร็จสมบูรณ์อัตโนมัติเมื่อแผนกการเงินจ่ายเงินแล้ว'] } });
			}

			const stepKey = `step_${currentStep.step_sequence}_${currentStep.step_name.replace(/\s+/g, '_').substring(0, 30)}`;

			// Build rich payload based on step type
			const uiType = (currentStep.ui_schema as any)?.type || 'unknown';
			const stepPayload: Record<string, unknown> = { ...parsedData };

			// Add uploaded PDF info
			if (stepPayload.uploaded_pdf) {
				stepPayload._meta = `อัปโหลดเอกสารสำเร็จ`;
			}

			// Add committee info
			if (uiType === 'committee') {
				const comps = (currentStep.ui_schema as any)?.components || [];
				const types = comps.filter((c: any) => c?.committee_type).map((c: any) => c.committee_type);
				if (types.length > 0) {
					stepPayload._meta = `บันทึกกรรมการประเภท ${types.join(' และ ')} ลงตาราง document_committees แล้ว`;
				}
			}

			// Add vendor proposal info
			if (uiType === 'vendor_proposal_with_upload') {
				stepPayload._meta = 'เอกสารใบเสนอราคาจาก Vendor ถูกบันทึกลงตาราง document_bidders แล้ว';
			}

			// Add evaluation info
			if (uiType === 'evaluation_with_scoring') {
				stepPayload._meta = 'คะแนนของผู้ยื่นซองแต่ละรายและสถานะผู้ชนะ ถูกอัปเดตลงในตาราง document_bidders แล้ว';
			}

			// Always add who/when
			stepPayload.completed_by = locals.user?.sub || null;
			stepPayload.completed_by_name = locals.user?.name || null;
			stepPayload.completed_at = new Date().toISOString();

			const updatedPayload = {
				...(doc.payload as Record<string, unknown>),
				[stepKey]: stepPayload
			};

			const nextStep = steps.find((s) => s.step_sequence === currentStep.step_sequence + 1);
			const isFinalStep = currentStep.is_final_step;

			await db
				.update(documents)
				.set({
					payload: updatedPayload,
					current_step_id: nextStep?.id || doc.current_step_id,
					status: isFinalStep ? 'APPROVED_PROCUREMENT' : 'IN_PROGRESS',
					updated_by: locals.user?.sub || null
				})
				.where(eq(documents.id, docId));

			if (locals.user) {
				const [agencyRow] = await db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, doc.agency_id));
				const [planRow] = await db.select({ title: plans.title }).from(plans).where(eq(plans.id, doc.plan_id));
				await writeAuditLog({
					collection: 'doc_payload_histories',
					action_type: 'STEP_ADVANCE',
					agency_id: doc.agency_id,
					agency_name: agencyRow?.name || '',
					document_id: docId,
					plan_id: doc.plan_id,
					plan_name: planRow?.title || '',
					step_id: currentStep.id,
					step_name: currentStep.step_name,
					payload_snapshot: updatedPayload,
					diff: parsedData,
					action_by: {
						user_id: locals.user.sub,
						name: locals.user.name,
						ip_address: getClientAddress()
					}
				});

				// Complete current user's assignment for the completed step
				await completeAssignment(docId, currentStep.id, locals.user.sub);

				// Assign and notify users for the next step
				if (nextStep && !isFinalStep) {
					await assignAndNotify(docId, nextStep.id, doc.agency_id, nextStep.step_name, locals.user?.sub);
				}
			}

			return { success: true, message: `บันทึกขั้นตอน "${currentStep.step_name}" สำเร็จ` };
		} catch (err) {
			console.error('Advance step error:', err);
			return fail(500, { success: false, errors: { step: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	addCommittee: async ({ request, params }) => {
		const parsed = parseFormData(addCommitteeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const docId = await resolveDocId(params.slug);
			await db.insert(documentCommittees).values({
				document_id: docId,
				user_id: parsed.data.user_id,
				committee_type: parsed.data.committee_type,
				role_in_committee: parsed.data.role_in_committee ?? null
			});

			return { success: true, message: 'เพิ่มกรรมการสำเร็จ' };
		} catch (err) {
			console.error('Add committee error:', err);
			return fail(500, { success: false, errors: { user_id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	removeCommittee: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('committee_id'));
		if (!id) return fail(400, { success: false, errors: { committee_id: ['ไม่พบรหัสกรรมการ'] } });

		try {
			await db.delete(documentCommittees).where(eq(documentCommittees.id, id));
			return { success: true, message: 'ลบกรรมการสำเร็จ' };
		} catch (err) {
			console.error('Remove committee error:', err);
			return fail(500, { success: false, errors: { committee_id: ['เกิดข้อผิดพลาด'] } });
		}
	},

	addBidder: async ({ request, params }) => {
		const parsed = parseFormData(addBidderSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const docId = await resolveDocId(params.slug);
			await db.insert(documentBidders).values({
				document_id: docId,
				vendor_id: parsed.data.vendor_id,
				proposed_price: parsed.data.proposed_price ?? null,
				submitted_at: new Date()
			});

			return { success: true, message: 'เพิ่มผู้ยื่นซองสำเร็จ' };
		} catch (err) {
			console.error('Add bidder error:', err);
			return fail(500, { success: false, errors: { vendor_id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	updateBidderScore: async ({ request }) => {
		const parsed = parseFormData(updateBidderScoreSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			await db
				.update(documentBidders)
				.set({ score: parsed.data.score ?? null, is_winner: parsed.data.is_winner })
				.where(eq(documentBidders.id, parsed.data.bidder_id));

			return { success: true, message: 'อัปเดตคะแนนสำเร็จ' };
		} catch (err) {
			console.error('Update bidder score error:', err);
			return fail(500, { success: false, errors: { bidder_id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	approve: async ({ request, params, locals, getClientAddress }) => {
		const parsed = parseFormData(approveSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const docId = await resolveDocId(params.slug);
			const { step_id, action, comment } = parsed.data;

			// Prevent double-approve: check if this user already approved this step
			const existingApproval = await db
				.select({ id: approvals.id })
				.from(approvals)
				.where(and(
					eq(approvals.document_id, docId),
					eq(approvals.step_id, step_id),
					eq(approvals.user_id, locals.user!.sub)
				))
				.limit(1);

			if (existingApproval.length > 0) {
				return fail(400, { success: false, errors: { step_id: ['คุณได้อนุมัติ/ปฏิเสธขั้นตอนนี้ไปแล้ว'] } });
			}

			// Verify document is still at this step
			const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
			if (!doc || doc.current_step_id !== step_id) {
				return fail(400, { success: false, errors: { step_id: ['ขั้นตอนนี้ไม่ใช่ขั้นตอนปัจจุบันแล้ว'] } });
			}

			await db.insert(approvals).values({
				document_id: docId,
				step_id,
				user_id: locals.user!.sub,
				action,
				comment: comment ?? null
			});

			// Complete the approver's assignment
			if (locals.user) {
				await completeAssignment(docId, step_id, locals.user.sub);
			}

			if (action === 'REJECTED') {
				await db.update(documents).set({ status: 'REJECTED' }).where(eq(documents.id, docId));

				// Notify document creator of rejection
				if (doc.updated_by) {
					const [step] = await db.select({ step_name: workflowSteps.step_name }).from(workflowSteps).where(eq(workflowSteps.id, step_id));
					await createNotification({
						userId: doc.updated_by,
						documentId: docId,
						stepId: step_id,
						title: 'เอกสารถูกปฏิเสธ',
						message: `เอกสาร #${docId} ถูกปฏิเสธในขั้นตอน "${step?.step_name || ''}"${comment ? ` — ${comment}` : ''}`,
						actionUrl: `/procurement/${docId}`,
						notificationType: 'DOCUMENT_REJECTED'
					});
				}
			} else {
				// APPROVED: auto-advance to next step
				const steps = await db
					.select()
					.from(workflowSteps)
					.where(eq(workflowSteps.workflow_id, doc.workflow_id))
					.orderBy(workflowSteps.step_sequence);

				const currentStep = steps.find((s) => s.id === step_id);
				if (currentStep) {
					const nextStep = steps.find((s) => s.step_sequence === currentStep.step_sequence + 1);
					const isFinalStep = currentStep.is_final_step;

					// Store approval data in payload
					const stepKey = `step_${currentStep.step_sequence}_${currentStep.step_name.replace(/\s+/g, '_').substring(0, 30)}`;
					const updatedPayload = {
						...(doc.payload as Record<string, unknown>),
						[stepKey]: {
							_meta: 'ผู้มีอำนาจกดอนุมัติแล้ว ข้อมูลถูกบันทึกลงตาราง approvals',
							approver: {
								user_id: locals.user!.sub,
								name: locals.user!.name,
								position: locals.user!.position_rank || null,
								approved_at: new Date().toISOString()
							},
							comment: comment ?? null
						}
					};

					await db
						.update(documents)
						.set({
							payload: updatedPayload,
							current_step_id: nextStep?.id || doc.current_step_id,
							status: isFinalStep ? 'APPROVED_PROCUREMENT' : 'IN_PROGRESS',
							updated_by: doc.updated_by
						})
						.where(eq(documents.id, docId));

					// Assign and notify users for the next step
					if (nextStep && !isFinalStep) {
						await assignAndNotify(docId, nextStep.id, doc.agency_id, nextStep.step_name, locals.user?.sub);
					}
				}
			}

			// Write audit log for approve/reject
			if (locals.user) {
				const [stepForAudit] = await db.select({ step_name: workflowSteps.step_name }).from(workflowSteps).where(eq(workflowSteps.id, step_id));
				const [agencyRow] = await db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, doc.agency_id));
				const [planRow] = await db.select({ title: plans.title }).from(plans).where(eq(plans.id, doc.plan_id));
				await writeAuditLog({
					collection: 'doc_payload_histories',
					action_type: action === 'APPROVED' ? 'STEP_APPROVED' : 'STEP_REJECTED',
					agency_id: doc.agency_id,
					agency_name: agencyRow?.name || '',
					document_id: docId,
					plan_id: doc.plan_id,
					plan_name: planRow?.title || '',
					step_id,
					step_name: stepForAudit?.step_name || '',
					comment: comment ?? null,
					action_by: {
						user_id: locals.user.sub,
						name: locals.user.name,
						ip_address: getClientAddress()
					}
				});
			}

			return { success: true, message: action === 'APPROVED' ? 'อนุมัติสำเร็จ — ส่งต่อขั้นตอนถัดไปแล้ว' : 'ปฏิเสธแล้ว' };
		} catch (err) {
			console.error('Approve error:', err);
			return fail(500, { success: false, errors: { step_id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	generateDika: async ({ request, params, locals, getClientAddress }) => {
		const parsed = parseFormData(generateDikaSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const docId = await resolveDocId(params.slug);
			const { gross_amount, fine_amount, tax_amount, payment_bank_account_id, tax_pool_account_id } = parsed.data;

			const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
			if (!doc) return fail(404, { success: false, errors: { step: ['ไม่พบเอกสาร'] } });

			const [winner] = await db
				.select()
				.from(documentBidders)
				.where(and(eq(documentBidders.document_id, docId), eq(documentBidders.is_winner, true)));

			if (!winner) {
				return fail(400, { success: false, errors: { step: ['ยังไม่มีผู้ชนะการประมูล'] } });
			}

			const net = Number(gross_amount) - Number(fine_amount) - Number(tax_amount);

			await db.insert(dikaVouchers).values({
				agency_id: doc.agency_id,
				document_id: docId,
				vendor_id: winner.vendor_id,
				plan_id: doc.plan_id,
				payment_bank_account_id,
				tax_pool_account_id: tax_pool_account_id ?? null,
				gross_amount,
				fine_amount,
				tax_amount,
				net_amount: net.toFixed(2),
				status: 'PENDING_EXAMINE'
			});

			// Write audit log
			if (locals.user) {
				const [agencyRow] = await db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, doc.agency_id));
				const [planRow] = await db.select({ title: plans.title }).from(plans).where(eq(plans.id, doc.plan_id));
				const [vendorRow] = await db.select({ company_name: vendors.company_name }).from(vendors).where(eq(vendors.id, winner.vendor_id));
				await writeAuditLog({
					collection: 'doc_payload_histories',
					action_type: 'GENERATE_DIKA',
					agency_id: doc.agency_id,
					agency_name: agencyRow?.name || '',
					document_id: docId,
					plan_id: doc.plan_id,
					plan_name: planRow?.title || '',
					dika_data: {
						gross_amount, fine_amount, tax_amount,
						net_amount: net.toFixed(2),
						vendor_id: winner.vendor_id,
						vendor_name: vendorRow?.company_name || ''
					},
					action_by: {
						user_id: locals.user.sub,
						name: locals.user.name,
						ip_address: getClientAddress()
					}
				});
			}

			// Auto-advance to the next step ("รอการเงินเบิกจ่าย")
			const allSteps = await db
				.select()
				.from(workflowSteps)
				.where(eq(workflowSteps.workflow_id, doc.workflow_id))
				.orderBy(asc(workflowSteps.step_sequence));

			const currentStep = allSteps.find((s) => s.id === doc.current_step_id);
			if (currentStep) {
				const nextStep = allSteps.find((s) => s.step_sequence === currentStep.step_sequence + 1);
				if (nextStep) {
					const stepKey = `step_${currentStep.step_sequence}_${currentStep.step_name.replace(/\s+/g, '_').substring(0, 30)}`;
					const updatedPayload = {
						...(doc.payload as Record<string, unknown>),
						[stepKey]: {
							_meta: 'สร้างฎีกาเบิกจ่ายและส่งไปยังแผนกการเงินแล้ว',
							completed_at: new Date().toISOString(),
							completed_by: locals.user?.sub || null,
							completed_by_name: locals.user?.name || null,
							dika_data: { gross_amount, fine_amount, tax_amount, net_amount: net.toFixed(2) }
						}
					};

					await db
						.update(documents)
						.set({
							payload: updatedPayload,
							current_step_id: nextStep.id,
							status: 'IN_PROGRESS',
							updated_by: locals.user?.sub || null
						})
						.where(eq(documents.id, docId));

					// Complete current user's assignment
					if (locals.user) {
						await completeAssignment(docId, currentStep.id, locals.user.sub);
					}
				}
			}

			// Notify finance head about new dika
			const { orgUnits } = await import('$lib/server/db/schema');
			const finHeadResult = await db
				.select({ head_of_unit_id: orgUnits.head_of_unit_id, name: orgUnits.name })
				.from(orgUnits)
				.where(eq(orgUnits.agency_id, doc.agency_id));
			const finUnit = finHeadResult.find((u) => u.name.includes('การเงิน') || u.name.includes('คลัง'));
			if (finUnit?.head_of_unit_id) {
				await createNotification({
					userId: finUnit.head_of_unit_id,
					documentId: docId,
					title: 'ฎีกาใหม่รอตรวจสอบ',
					message: `ฎีกาเบิกจ่ายสำหรับเอกสาร #${docId} ถูกสร้างแล้ว — กรุณาตรวจสอบ (${net.toFixed(2)} บาท)`,
					actionUrl: '/finance',
					notificationType: 'APPROVAL_REQUIRED'
				});
			}

			return { success: true, message: 'สร้างฎีกาเบิกจ่ายสำเร็จ — ส่งไปยังแผนกการเงินแล้ว' };
		} catch (err) {
			console.error('Generate dika error:', err);
			return fail(500, { success: false, errors: { gross_amount: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	// ── v2 Approval Flow Actions ──

	approveStep: async ({ request, params, locals }) => {
		const form = await request.formData();
		const docId = await resolveDocId(params.slug);
		const stepId = Number(form.get('step_id'));
		const action = form.get('action') as 'APPROVED' | 'REJECTED';
		const comment = form.get('comment') as string | null;

		if (!stepId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
			return fail(400, { success: false, errors: { step: ['ข้อมูลไม่ถูกต้อง'] } });
		}

		try {
			const { advanceApprovalStep } = await import('$lib/server/approval-flow');
			const result = await advanceApprovalStep(docId, stepId, locals.user.sub, action, comment ?? undefined);

			if (result === 'EXECUTION') {
				// Document approved — create first payment round
				const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
				if (doc?.doc_type) {
					const { createFirstPaymentRound } = await import('$lib/server/payment-rounds');
					await createFirstPaymentRound(docId, doc.doc_type);
				}
				return { success: true, message: 'อนุมัติเอกสารสำเร็จ — เข้าสู่ขั้นตอนดำเนินการ' };
			}

			if (result === 'REJECTED') {
				return { success: true, message: 'ปฏิเสธเอกสารแล้ว' };
			}

			return { success: true, message: action === 'APPROVED' ? 'อนุมัติสำเร็จ — ส่งต่อขั้นตอนถัดไป' : 'ปฏิเสธเอกสารแล้ว' };
		} catch (err: any) {
			console.error('Approve step error:', err);
			return fail(400, { success: false, errors: { step: [err.message || 'เกิดข้อผิดพลาด'] } });
		}
	},

	uploadBillFile: async ({ request, params }) => {
		const form = await request.formData();
		const file = form.get('file') as File | null;
		const sectionKey = form.get('section_key') as string;
		const fieldKey = form.get('field_key') as string;

		if (!file || file.size === 0) {
			return fail(400, { success: false, errors: { file: ['กรุณาเลือกไฟล์'] } });
		}
		if (file.size > 20 * 1024 * 1024) {
			return fail(400, { success: false, errors: { file: ['ไฟล์ต้องไม่เกิน 20MB'] } });
		}

		try {
			const { uploadFile: doUpload, generateUploadPath } = await import('$lib/server/upload');
			const docSlug = params.slug;
			const path = generateUploadPath(docSlug, sectionKey, fieldKey, file.name);
			const url = await doUpload(file, path);
			return { success: true, url, filename: file.name };
		} catch (err: any) {
			console.error('Upload error:', err);
			return fail(500, { success: false, errors: { file: [err.message || 'อัปโหลดล้มเหลว'] } });
		}
	},

	saveBillDraft: async ({ request, params, locals }) => {
		const form = await request.formData();
		const roundId = Number(form.get('round_id'));
		const billPayloadRaw = form.get('bill_payload') as string;

		if (!roundId) return fail(400, { success: false, errors: { round: ['ไม่พบรอบการจ่ายเงิน'] } });

		try {
			const { paymentRounds: pr } = await import('$lib/server/db/schema');
			let payload = {};
			try { payload = JSON.parse(billPayloadRaw); } catch {}

			await db
				.update(pr)
				.set({ bill_payload: payload })
				.where(eq(pr.id, roundId));

			return { success: true, message: 'บันทึกร่างเอกสารสำเร็จ' };
		} catch (err) {
			return fail(500, { success: false, errors: { round: ['เกิดข้อผิดพลาด'] } });
		}
	},

	submitBill: async ({ request, params, locals }) => {
		const form = await request.formData();
		const docId = await resolveDocId(params.slug);
		const roundId = Number(form.get('round_id'));
		const billPayloadRaw = form.get('bill_payload') as string;

		if (!roundId) return fail(400, { success: false, errors: { round: ['ไม่พบรอบการจ่ายเงิน'] } });

		try {
			const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
			if (!doc?.doc_type) return fail(400, { success: false, errors: { round: ['เอกสารไม่ถูกต้อง'] } });

			let payload = {};
			try { payload = JSON.parse(billPayloadRaw); } catch {}

			const { advancePaymentRound } = await import('$lib/server/payment-rounds');

			// Advance from BILL_PENDING → BILL_CREATED
			await advancePaymentRound(roundId, doc.doc_type, {
				bill_payload: payload,
				bill_created_by: locals.user.sub
			});

			// Advance from BILL_CREATED → SENT_TO_FINANCE
			await advancePaymentRound(roundId, doc.doc_type);

			// Notify finance
			const { agencySettings } = await import('$lib/server/db/schema');
			const [settings] = await db.select().from(agencySettings).where(eq(agencySettings.agency_id, doc.agency_id));
			if (settings?.finance_unit_id) {
				const { orgUnits } = await import('$lib/server/db/schema');
				const [financeUnit] = await db.select().from(orgUnits).where(eq(orgUnits.id, settings.finance_unit_id));
				if (financeUnit?.head_of_unit_id) {
					const { notifications } = await import('$lib/server/db/schema');
					await db.insert(notifications).values({
						user_id: financeUnit.head_of_unit_id,
						document_id: docId,
						title: 'เอกสารจัดซื้อจัดจ้างรอเบิกจ่าย',
						message: `เอกสาร #${docId} ส่งมาจากฝ่ายจัดซื้อจัดจ้างแล้ว`,
						action_url: '/finance',
						notification_type: 'APPROVAL_REQUIRED'
					});
				}
			}

			return { success: true, message: 'ส่งเอกสารไปฝ่ายการเงินสำเร็จ' };
		} catch (err: any) {
			return fail(400, { success: false, errors: { round: [err.message || 'เกิดข้อผิดพลาด'] } });
		}
	},

	advanceRound: async ({ request, params, locals }) => {
		const form = await request.formData();
		const docId = await resolveDocId(params.slug);
		const roundId = Number(form.get('round_id'));
		const billPayloadRaw = form.get('bill_payload') as string | null;

		if (!roundId) {
			return fail(400, { success: false, errors: { round: ['ไม่พบรอบการจ่ายเงิน'] } });
		}

		try {
			const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
			if (!doc?.doc_type) {
				return fail(400, { success: false, errors: { round: ['เอกสารไม่ถูกต้อง'] } });
			}

			const { advancePaymentRound } = await import('$lib/server/payment-rounds');

			const additionalData: any = {};
			if (billPayloadRaw) {
				try { additionalData.bill_payload = JSON.parse(billPayloadRaw); } catch {}
				additionalData.bill_created_by = locals.user.sub;
			}
			if (form.get('check_no')) additionalData.check_no = form.get('check_no');
			if (form.get('check_date')) additionalData.check_date = form.get('check_date');
			if (form.get('finance_seen_by')) additionalData.finance_seen_by = locals.user.sub;
			if (form.get('paid_by')) additionalData.paid_by = locals.user.sub;
			if (form.get('stamped_by')) additionalData.stamped_by = locals.user.sub;
			if (form.get('dika_voucher_id')) additionalData.dika_voucher_id = Number(form.get('dika_voucher_id'));

			const newStatus = await advancePaymentRound(roundId, doc.doc_type, additionalData);

			return { success: true, message: `สถานะเปลี่ยนเป็น ${newStatus}` };
		} catch (err: any) {
			console.error('Advance round error:', err);
			return fail(400, { success: false, errors: { round: [err.message || 'เกิดข้อผิดพลาด'] } });
		}
	},

	createProjectItem: async ({ request, params }) => {
		const form = await request.formData();
		const docId = await resolveDocId(params.slug);
		const item_name = form.get('item_name') as string;
		const item_type = form.get('item_type') as string;
		const estimated_amount = form.get('estimated_amount') as string;

		if (!item_name || !item_type || !['pFinance', 'pParcel'].includes(item_type)) {
			return fail(400, { success: false, errors: { item: ['กรุณาระบุข้อมูลให้ครบ'] } });
		}

		try {
			const { projectItems } = await import('$lib/server/db/schema');
			await db.insert(projectItems).values({
				document_id: docId,
				item_name,
				item_type,
				estimated_amount: estimated_amount || '0',
				status: 'PENDING'
			});
			return { success: true, message: 'เพิ่มรายการโครงการสำเร็จ' };
		} catch (err) {
			console.error('Create project item error:', err);
			return fail(500, { success: false, errors: { item: ['เกิดข้อผิดพลาด'] } });
		}
	},

	closeProject: async ({ params, locals }) => {
		const docId = await resolveDocId(params.slug);
		try {
			const { projectItems } = await import('$lib/server/db/schema');
			const items = await db.select().from(projectItems).where(eq(projectItems.document_id, docId));

			const allDone = items.every((i: any) => i.status === 'COMPLETED');
			if (!allDone) {
				return fail(400, { success: false, errors: { project: ['ต้องดำเนินการรายการทั้งหมดให้เสร็จก่อนปิดโครงการ'] } });
			}

			await db
				.update(documents)
				.set({ phase: 'COMPLETED', status: 'PAID' })
				.where(eq(documents.id, docId));

			return { success: true, message: 'ปิดโครงการสำเร็จ' };
		} catch (err) {
			console.error('Close project error:', err);
			return fail(400, { success: false, errors: { project: ['เกิดข้อผิดพลาด'] } });
		}
	},

	createNextRound: async ({ params, locals }) => {
		const docId = await resolveDocId(params.slug);

		try {
			const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
			if (!doc?.doc_type) {
				return fail(400, { success: false, errors: { round: ['เอกสารไม่ถูกต้อง'] } });
			}

			const { createNextPaymentRound, isMultiRoundType } = await import('$lib/server/payment-rounds');

			if (!isMultiRoundType(doc.doc_type)) {
				return fail(400, { success: false, errors: { round: ['ประเภทเอกสารนี้ไม่รองรับการจ่ายหลายรอบ'] } });
			}

			const round = await createNextPaymentRound(docId, doc.doc_type);
			return { success: true, message: `สร้างรอบที่ ${round.round_number} สำเร็จ` };
		} catch (err: any) {
			console.error('Create next round error:', err);
			return fail(400, { success: false, errors: { round: [err.message || 'เกิดข้อผิดพลาด'] } });
		}
	}
};
