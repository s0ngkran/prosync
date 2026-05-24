import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { plans, fiscalYears, agencies, orgUnits, provinces } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { writeAuditLog } from '$lib/server/db/audit';
import { createFiscalYearSchema, createPlanSchema, updatePlanSchema, parseFormData } from '$lib/server/validation/schemas';
import { getAgencyScope } from '$lib/server/auth/scope';

function calcDuration(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
	if (!startDate || !endDate) return null;
	const start = new Date(startDate);
	const end = new Date(endDate);
	const diffMs = end.getTime() - start.getTime();
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
	if (diffDays < 0) return null;
	if (diffDays < 30) return `${diffDays} วัน`;
	const months = Math.floor(diffDays / 30);
	const remainDays = diffDays % 30;
	if (remainDays === 0) return `${months} เดือน`;
	return `${months} เดือน ${remainDays} วัน`;
}

interface FiscalYearRow {
	id: number;
	is_active: boolean;
	[key: string]: unknown;
}

export const load: PageServerLoad = async ({ parent, url, cookies }) => {
	const { user } = await parent();

	const agencyId = getAgencyScope(user, cookies);
	const selectedProvinceId: number | null = null;

	let fiscalYearList: FiscalYearRow[] = [];
	let planList: typeof plans.$inferSelect[] = [];
	let agencyList: { id: number; name: string }[] = [];
	let provinceList: { id: number; name: string }[] = [];

	if (user.is_super_admin) {
		provinceList = await db.select({ id: provinces.id, name: provinces.name }).from(provinces);
		if (selectedProvinceId) {
			agencyList = await db
				.select({ id: agencies.id, name: agencies.name })
				.from(agencies)
				.where(eq(agencies.province_id, selectedProvinceId));
		}
	}

	let orgUnitList: typeof orgUnits.$inferSelect[] = [];

	if (agencyId) {
		fiscalYearList = await db
			.select()
			.from(fiscalYears)
			.where(eq(fiscalYears.agency_id, agencyId));

		orgUnitList = await db
			.select()
			.from(orgUnits)
			.where(eq(orgUnits.agency_id, agencyId));

		const fyIdParam = url.searchParams.get('fy_id');
		const selectedFy = fyIdParam
			? Number(fyIdParam)
			: fiscalYearList.find((fy) => fy.is_active)?.id || fiscalYearList[0]?.id;

		if (selectedFy) {
			planList = await db
				.select()
				.from(plans)
				.where(and(eq(plans.agency_id, agencyId), eq(plans.fiscal_year_id, selectedFy)));
		}

		return {
			user,
			provinces: provinceList,
			agencies: agencyList,
			fiscalYears: fiscalYearList,
			orgUnits: orgUnitList,
			plans: planList,
			selectedProvinceId,
			selectedAgencyId: agencyId,
			selectedFyId: selectedFy || null
		};
	}

	return {
		user,
		provinces: provinceList,
		agencies: agencyList,
		fiscalYears: fiscalYearList,
		orgUnits: orgUnitList,
		plans: planList,
		selectedProvinceId,
		selectedAgencyId: agencyId,
		selectedFyId: null
	};
};

export const actions: Actions = {
	createFiscalYear: async ({ request }) => {
		const parsed = parseFormData(createFiscalYearSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			await db.insert(fiscalYears).values(parsed.data);
			return { success: true, message: 'สร้างปีงบประมาณสำเร็จ' };
		} catch (err) {
			console.error('Create fiscal year error:', err);
			return fail(500, { success: false, errors: { year_name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	duplicateFiscalYear: async ({ request }) => {
		const form = await request.formData();
		const year_name = form.get('year_name')?.toString().trim();
		const agency_id = Number(form.get('agency_id'));
		const source_fy_id = Number(form.get('source_fy_id'));

		if (!year_name || !agency_id) {
			return fail(400, { success: false, errors: { year_name: ['กรุณากรอกข้อมูลให้ครบ'] } });
		}

		try {
			// Create the new fiscal year
			const [newFy] = await db.insert(fiscalYears).values({
				agency_id,
				year_name
			}).returning();

			if (!source_fy_id) {
				return { success: true, message: 'สร้างปีงบประมาณสำเร็จ (ว่าง)' };
			}

			// Load all plans from source fiscal year
			const sourcePlans = await db
				.select()
				.from(plans)
				.where(and(eq(plans.agency_id, agency_id), eq(plans.fiscal_year_id, source_fy_id)));

			if (sourcePlans.length === 0) {
				return { success: true, message: 'สร้างปีงบประมาณสำเร็จ (ปีต้นทางไม่มีแผน)' };
			}

			// Duplicate plans maintaining hierarchy
			// First pass: create root plans (no parent), map old_id → new_id
			const idMap = new Map<number, number>();

			// Sort: root plans first, then children
			const roots = sourcePlans.filter((p) => !p.parent_id);
			const children = sourcePlans.filter((p) => p.parent_id);

			for (const plan of roots) {
				const [newPlan] = await db.insert(plans).values({
					agency_id,
					fiscal_year_id: newFy.id,
					title: plan.title,
					parent_id: null,
					responsible_unit_id: plan.responsible_unit_id,
					start_date: plan.start_date,
					end_date: plan.end_date,
					duration_text: plan.duration_text,
					expected_outputs: plan.expected_outputs,
					description: plan.description,
					stakeholder_unit_ids: plan.stakeholder_unit_ids,
					plan_type: plan.plan_type,
					is_leaf_node: plan.is_leaf_node,
					estimated_amount: plan.estimated_amount,
					actual_amount: '0'
				}).returning();
				idMap.set(plan.id, newPlan.id);
			}

			// Multi-pass for children (handle deep nesting)
			let remaining = [...children];
			let maxPasses = 10;
			while (remaining.length > 0 && maxPasses > 0) {
				const next: typeof remaining = [];
				for (const plan of remaining) {
					const newParentId = plan.parent_id ? idMap.get(plan.parent_id) : null;
					if (plan.parent_id && !newParentId) {
						next.push(plan); // parent not created yet, try next pass
						continue;
					}
					const [newPlan] = await db.insert(plans).values({
						agency_id,
						fiscal_year_id: newFy.id,
						title: plan.title,
						parent_id: newParentId ?? null,
						responsible_unit_id: plan.responsible_unit_id,
						start_date: plan.start_date,
						end_date: plan.end_date,
						duration_text: plan.duration_text,
						expected_outputs: plan.expected_outputs,
						description: plan.description,
						stakeholder_unit_ids: plan.stakeholder_unit_ids,
						plan_type: plan.plan_type,
						is_leaf_node: plan.is_leaf_node,
						estimated_amount: plan.estimated_amount,
						actual_amount: '0'
					}).returning();
					idMap.set(plan.id, newPlan.id);
				}
				remaining = next;
				maxPasses--;
			}

			return { success: true, message: `สร้างปีงบประมาณ ${year_name} สำเร็จ พร้อมคัดลอก ${idMap.size} แผนจากปีต้นทาง` };
		} catch (err) {
			console.error('Duplicate fiscal year error:', err);
			return fail(500, { success: false, errors: { year_name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	createPlan: async ({ request, locals, getClientAddress }) => {
		const parsed = parseFormData(createPlanSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { agency_id, fiscal_year_id, title, parent_id, responsible_unit_id, start_date, end_date, expected_outputs, description, stakeholder_unit_ids, plan_type, is_leaf_node, estimated_amount } = parsed.data;

			// For sub-plans: inherit plan_type and responsible_unit_id from parent
			let finalPlanType = plan_type;
			let finalResponsibleUnitId: number | null = responsible_unit_id;
			if (parent_id) {
				const [parentPlan] = await db.select().from(plans).where(eq(plans.id, parent_id));
				if (parentPlan) {
					finalPlanType = parentPlan.plan_type as 'INCOME' | 'EXPENSE';
					finalResponsibleUnitId = parentPlan.responsible_unit_id;

					// Validate date range against parent plan
					if (parentPlan.start_date && parentPlan.end_date) {
						if (start_date && start_date < parentPlan.start_date) {
							return fail(400, { success: false, errors: { start_date: [`วันที่เริ่มต้นต้องไม่ก่อน ${parentPlan.start_date} (วันเริ่มของแผนแม่)`] } });
						}
						if (end_date && end_date > parentPlan.end_date) {
							return fail(400, { success: false, errors: { end_date: [`วันที่สิ้นสุดต้องไม่เกิน ${parentPlan.end_date} (วันสิ้นสุดของแผนแม่)`] } });
						}
					}
				}
			}

			// Only leaf nodes can set estimated_amount
			const finalEstimatedAmount = is_leaf_node ? (estimated_amount || '0') : '0';

			// Parse expected_outputs as JSON array
			let parsedExpectedOutputs = null;
			if (expected_outputs) {
				parsedExpectedOutputs = expected_outputs.split('\n').filter((s: string) => s.trim()).map((s: string) => s.trim());
			}

			const [created] = await db
				.insert(plans)
				.values({
					agency_id,
					fiscal_year_id,
					title,
					parent_id: parent_id ?? null,
					responsible_unit_id: finalResponsibleUnitId,
					start_date,
					end_date,
					duration_text: calcDuration(start_date, end_date),
					expected_outputs: parsedExpectedOutputs,
					description: description ?? null,
					stakeholder_unit_ids: stakeholder_unit_ids,
					plan_type: finalPlanType,
					is_leaf_node,
					estimated_amount: finalEstimatedAmount
				})
				.returning();

			if (locals.user) {
				// Resolve names for audit log
				const [agencyRow] = await db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, agency_id));
				await writeAuditLog({
					collection: 'plan_budget_histories',
					action_type: 'CREATE',
					agency_id,
					agency_name: agencyRow?.name || '',
					plan_id: created.id,
					plan_name: title,
					changes: {
						estimated_amount: { old: 0, new: Number(estimated_amount) || 0 },
						actual_amount: { old: 0, new: 0 }
					},
					action_by: {
						user_id: locals.user.sub,
						name: locals.user.name,
						position: '',
						ip_address: getClientAddress()
					}
				});
			}

			return { success: true, message: 'สร้างแผนงานสำเร็จ' };
		} catch (err) {
			console.error('Create plan error:', err);
			return fail(500, { success: false, errors: { title: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	updatePlan: async ({ request, locals, getClientAddress }) => {
		const parsed = parseFormData(updatePlanSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { id, title, responsible_unit_id, start_date, end_date, expected_outputs, description, stakeholder_unit_ids, estimated_amount, is_leaf_node } = parsed.data;

			const [oldPlan] = await db.select().from(plans).where(eq(plans.id, id));

			// Validate date range against parent plan
			if (oldPlan?.parent_id && (start_date || end_date)) {
				const [parentPlan] = await db.select().from(plans).where(eq(plans.id, oldPlan.parent_id));
				if (parentPlan?.start_date && parentPlan?.end_date) {
					if (start_date && start_date < parentPlan.start_date) {
						return fail(400, { success: false, errors: { start_date: [`วันที่เริ่มต้นต้องไม่ก่อน ${parentPlan.start_date} (วันเริ่มของแผนแม่)`] } });
					}
					if (end_date && end_date > parentPlan.end_date) {
						return fail(400, { success: false, errors: { end_date: [`วันที่สิ้นสุดต้องไม่เกิน ${parentPlan.end_date} (วันสิ้นสุดของแผนแม่)`] } });
					}
				}
			}

			const isRootPlan = !oldPlan?.parent_id; // sub-plans inherit responsible_unit from parent
			const finalEstimatedAmount = is_leaf_node ? (estimated_amount || '0') : '0';

			let parsedExpectedOutputs = null;
			if (expected_outputs) {
				parsedExpectedOutputs = expected_outputs.split('\n').filter((s: string) => s.trim()).map((s: string) => s.trim());
			}

			await db
				.update(plans)
				.set({
					title,
					responsible_unit_id: isRootPlan ? (responsible_unit_id ?? null) : undefined,
					start_date: start_date ?? null,
					end_date: end_date ?? null,
					duration_text: calcDuration(start_date, end_date),
					expected_outputs: parsedExpectedOutputs,
					description: description ?? null,
					stakeholder_unit_ids: stakeholder_unit_ids ?? null,
					estimated_amount: finalEstimatedAmount,
					is_leaf_node
				})
				.where(eq(plans.id, id));

			if (locals.user && oldPlan) {
				const [agencyRow] = await db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, oldPlan.agency_id));
				await writeAuditLog({
					collection: 'plan_budget_histories',
					action_type: 'MANUAL_ADJUST',
					agency_id: oldPlan.agency_id,
					agency_name: agencyRow?.name || '',
					plan_id: id,
					plan_name: title,
					changes: {
						estimated_amount: {
							old: Number(oldPlan.estimated_amount),
							new: Number(estimated_amount) || 0
						}
					},
					action_by: {
						user_id: locals.user.sub,
						name: locals.user.name,
						position: '',
						ip_address: getClientAddress()
					}
				});
			}

			return { success: true, message: 'แก้ไขแผนงานสำเร็จ' };
		} catch (err) {
			console.error('Update plan error:', err);
			return fail(500, { success: false, errors: { title: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	deletePlan: async ({ request, locals, getClientAddress }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));

		if (!id || isNaN(id)) {
			return fail(400, { success: false, errors: { id: ['ไม่พบแผนงาน'] } });
		}

		try {
			const [oldPlan] = await db.select().from(plans).where(eq(plans.id, id));

			await db.delete(plans).where(eq(plans.id, id));

			if (locals.user && oldPlan) {
				const [agencyRow] = await db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, oldPlan.agency_id));
				await writeAuditLog({
					collection: 'plan_budget_histories',
					action_type: 'DELETE',
					agency_id: oldPlan.agency_id,
					agency_name: agencyRow?.name || '',
					plan_id: id,
					plan_name: oldPlan.title,
					changes: {
						estimated_amount: { old: Number(oldPlan.estimated_amount), new: 0 },
						actual_amount: { old: Number(oldPlan.actual_amount), new: 0 }
					},
					action_by: {
						user_id: locals.user.sub,
						name: locals.user.name,
						position: '',
						ip_address: getClientAddress()
					}
				});
			}

			return { success: true, message: 'ลบแผนงานสำเร็จ' };
		} catch (err) {
			console.error('Delete plan error:', err);
			return fail(500, { success: false, errors: { id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	importPlanCsv: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin && !locals.user?.permissions.can_manage_plans) {
			return fail(403, { success: false, errors: { csv: ['ไม่มีสิทธิ์'] } });
		}

		const formData = await request.formData();
		const file = formData.get('csv_file') as File | null;
		const fiscal_year_id = Number(formData.get('fiscal_year_id'));
		const agency_id = Number(formData.get('agency_id'));
		if (!file || file.size === 0) return fail(400, { success: false, errors: { csv: ['กรุณาเลือกไฟล์ CSV'] } });
		if (!fiscal_year_id || !agency_id) return fail(400, { success: false, errors: { csv: ['กรุณาเลือกปีงบประมาณก่อน'] } });

		try {
			const text = await file.text();
			const { parseCsv } = await import('$lib/utils/format');
			const rows = parseCsv(text);
			if (rows.length === 0) return fail(400, { success: false, errors: { csv: ['ไฟล์ CSV ว่างเปล่า'] } });

			// Load org units for name→id mapping
			const allUnits = await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits);
			const unitMap = new Map(allUnits.map((u) => [u.name.trim(), u.id]));

			// Load existing plans for parent title→id mapping
			const existingPlans = await db.select({ id: plans.id, title: plans.title })
				.from(plans)
				.where(and(eq(plans.agency_id, agency_id), eq(plans.fiscal_year_id, fiscal_year_id)));
			const planMap = new Map(existingPlans.map((p) => [p.title.trim(), p.id]));

			let created = 0;
			let skipped = 0;

			for (const row of rows) {
				const title = row['ชื่อแผน']?.trim();
				const planType = row['ประเภท']?.trim()?.toUpperCase();
				const startDate = row['วันเริ่มต้น']?.trim();
				const endDate = row['วันสิ้นสุด']?.trim();
				if (!title || !planType || !startDate || !endDate) { skipped++; continue; }
				if (planType !== 'INCOME' && planType !== 'EXPENSE') { skipped++; continue; }

				const parentTitle = row['แผนแม่']?.trim();
				const parentId = parentTitle ? planMap.get(parentTitle) ?? null : null;

				const responsibleName = row['หน่วยรับผิดชอบ']?.trim();
				const responsibleUnitId = responsibleName ? unitMap.get(responsibleName) ?? null : null;

				// Parse stakeholder names (comma-separated)
				const stakeholderNames = row['หน่วยงานที่เกี่ยวข้อง']?.trim();
				let stakeholderIds: number[] = [];
				if (stakeholderNames) {
					stakeholderIds = stakeholderNames.split(',').map((n: string) => unitMap.get(n.trim())).filter((id): id is number => !!id);
				}
				if (stakeholderIds.length === 0 && responsibleUnitId) {
					stakeholderIds = [responsibleUnitId];
				}

				const isLeaf = row['เป็นแผนย่อยสุด']?.trim()?.toLowerCase();
				const isLeafNode = isLeaf === 'ใช่' || isLeaf === 'true';
				const estimatedAmount = row['งบประมาณ']?.trim();

				const [newPlan] = await db.insert(plans).values({
					agency_id,
					fiscal_year_id,
					title,
					parent_id: parentId,
					responsible_unit_id: responsibleUnitId,
					start_date: startDate,
					end_date: endDate,
					duration_text: calcDuration(startDate, endDate),
					description: row['รายละเอียด']?.trim() || null,
					expected_outputs: row['ผลผลิตที่คาดหวัง']?.trim() ? row['ผลผลิตที่คาดหวัง'].split('\n').map((s: string) => s.trim()).filter(Boolean) : null,
					stakeholder_unit_ids: stakeholderIds.length > 0 ? stakeholderIds : null,
					plan_type: planType,
					is_leaf_node: isLeafNode,
					estimated_amount: isLeafNode && estimatedAmount ? parseFloat(estimatedAmount).toFixed(2) : '0'
				}).returning();

				// Add to map so later rows can reference this as parent
				planMap.set(title, newPlan.id);
				created++;
			}

			const msg = `นำเข้าสำเร็จ ${created} แผน` + (skipped > 0 ? ` (ข้าม ${skipped} รายการ)` : '');
			return { success: true, message: msg };
		} catch (err) {
			console.error('Import plan CSV error:', err);
			return fail(500, { success: false, errors: { csv: ['เกิดข้อผิดพลาดในการนำเข้า'] } });
		}
	}
};
