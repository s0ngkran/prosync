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
	}
};
