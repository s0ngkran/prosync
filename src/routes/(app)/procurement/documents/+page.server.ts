import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	documents,
	workflows,
	workflowSteps,
	plans,
	fiscalYears,
	agencies,
	provinces
} from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { createDocumentSchema, parseFormData } from '$lib/server/validation/schemas';
import { getAgencyScope } from '$lib/server/auth/scope';

export const load: PageServerLoad = async ({ parent, url, cookies }) => {
	const { user } = await parent();

	const agencyId = getAgencyScope(user, cookies);

	const workflowList = await db.select().from(workflows);
	const stepsList = await db.select().from(workflowSteps);

	let documentList: any[] = [];
	let leafPlanList: any[] = [];

	// Load fiscal years for filtering
	let fyList: { id: number; year_name: string; is_active: boolean }[] = [];

	if (agencyId) {
		fyList = await db
			.select({ id: fiscalYears.id, year_name: fiscalYears.year_name, is_active: fiscalYears.is_active })
			.from(fiscalYears)
			.where(eq(fiscalYears.agency_id, agencyId));

		documentList = await db
			.select({
				id: documents.id,
				agency_id: documents.agency_id,
				workflow_id: documents.workflow_id,
				workflow_name: workflows.name,
				plan_id: documents.plan_id,
				plan_title: plans.title,
				fiscal_year_id: plans.fiscal_year_id,
				current_step_id: documents.current_step_id,
				payload: documents.payload,
				status: documents.status
			})
			.from(documents)
			.innerJoin(workflows, eq(documents.workflow_id, workflows.id))
			.innerJoin(plans, eq(documents.plan_id, plans.id))
			.where(eq(documents.agency_id, agencyId))
			.orderBy(asc(documents.id));

		leafPlanList = await db
			.select({
				id: plans.id,
				title: plans.title,
				estimated_amount: plans.estimated_amount,
				actual_amount: plans.actual_amount,
				fiscal_year: fiscalYears.year_name,
				fiscal_year_id: fiscalYears.id
			})
			.from(plans)
			.innerJoin(fiscalYears, eq(plans.fiscal_year_id, fiscalYears.id))
			.where(and(eq(plans.agency_id, agencyId), eq(plans.is_leaf_node, true)));
	}

	return {
		user,
		documents: documentList,
		workflows: workflowList,
		workflowSteps: stepsList,
		leafPlans: leafPlanList,
		fiscalYears: fyList,
		provinces: [] as { id: number; name: string }[],
		agencies: [] as any[],
		selectedProvinceId: null as number | null,
		selectedAgencyId: agencyId
	};
};

export const actions: Actions = {
	createDocument: async ({ request, locals }) => {
		const parsed = parseFormData(createDocumentSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { agency_id, workflow_id, plan_id } = parsed.data;

			const existing = await db
				.select()
				.from(documents)
				.where(and(eq(documents.plan_id, plan_id), eq(documents.status, 'IN_PROGRESS')));

			if (existing.length > 0) {
				return fail(400, {
					success: false,
					errors: { plan_id: [`เอกสารนี้อยู่ระหว่างดำเนินการ [#${existing[0].id}]`] }
				});
			}

			const [firstStep] = await db
				.select()
				.from(workflowSteps)
				.where(and(eq(workflowSteps.workflow_id, workflow_id), eq(workflowSteps.step_sequence, 1)));

			const [newDoc] = await db.insert(documents).values({
				agency_id,
				workflow_id,
				plan_id,
				current_step_id: firstStep?.id || null,
				payload: {},
				status: 'IN_PROGRESS',
				updated_by: locals.user?.sub || null
			}).returning();

			// Auto-assign step 1 to the creator and notify them
			if (firstStep && locals.user?.sub && newDoc) {
				const { assignAndNotify } = await import('$lib/server/step-assignments');
				await assignAndNotify(newDoc.id, firstStep.id, agency_id, firstStep.step_name);
			}

			return { success: true, message: 'สร้างเอกสารจัดซื้อจัดจ้างสำเร็จ' };
		} catch (err) {
			console.error('Create document error:', err);
			return fail(500, { success: false, errors: { plan_id: ['เกิดข้อผิดพลาด'] } });
		}
	}
};
