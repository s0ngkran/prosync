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
import { eq, and, asc, inArray } from 'drizzle-orm';
import { createDocumentSchema, parseFormData } from '$lib/server/validation/schemas';
import { getAgencyScope, loadScopeData } from '$lib/server/auth/scope';

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

		// Legacy documents (with workflow_id)
		documentList = await db
			.select({
				id: documents.id, slug: documents.slug,
				agency_id: documents.agency_id,
				workflow_id: documents.workflow_id,
				workflow_name: workflows.name,
				plan_id: documents.plan_id,
				plan_title: plans.title,
				fiscal_year_id: plans.fiscal_year_id,
				current_step_id: documents.current_step_id,
				payload: documents.payload,
				status: documents.status,
				doc_type: documents.doc_type,
				procurement_method: documents.procurement_method,
				phase: documents.phase
			})
			.from(documents)
			.innerJoin(workflows, eq(documents.workflow_id, workflows.id))
			.innerJoin(plans, eq(documents.plan_id, plans.id))
			.where(eq(documents.agency_id, agencyId))
			.orderBy(asc(documents.id));

		// V2 documents (approval + execution phase, no workflow_id)
		const v2Docs = await db
			.select({
				id: documents.id, slug: documents.slug,
				agency_id: documents.agency_id,
				workflow_id: documents.workflow_id,
				plan_id: documents.plan_id,
				plan_title: plans.title,
				fiscal_year_id: plans.fiscal_year_id,
				current_step_id: documents.current_step_id,
				payload: documents.payload,
				status: documents.status,
				doc_type: documents.doc_type,
				procurement_method: documents.procurement_method,
				phase: documents.phase
			})
			.from(documents)
			.innerJoin(plans, eq(documents.plan_id, plans.id))
			.where(and(
				eq(documents.agency_id, agencyId),
				inArray(documents.phase, ['APPROVAL', 'EXECUTION', 'COMPLETED'])
			))
			.orderBy(asc(documents.id));

		// Merge, avoiding duplicates
		const existingIds = new Set(documentList.map((d: any) => d.id));
		for (const d of v2Docs) {
			if (!existingIds.has(d.id)) {
				documentList.push({ ...d, workflow_name: null });
			}
		}

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
		...(await loadScopeData(user, cookies, db, provinces, agencies, eq)),
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

			const { generateSlug } = await import('$lib/server/utils');
			const [newDoc] = await db.insert(documents).values({
				slug: generateSlug(),
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
	},

	createDocumentV2: async ({ request, locals }) => {
		const form = await request.formData();
		const agency_id = Number(form.get('agency_id'));
		const plan_id = Number(form.get('plan_id'));
		const doc_type = form.get('doc_type') as string;
		const procurement_method = form.get('procurement_method') as string | null;

		if (!agency_id || !plan_id || !doc_type) {
			return fail(400, { success: false, errors: { doc_type: ['กรุณาเลือกประเภทเอกสารและแผนงาน'] } });
		}

		const validDocTypes = ['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel', 'type4_iFinance', 'type5_project'];
		if (!validDocTypes.includes(doc_type)) {
			return fail(400, { success: false, errors: { doc_type: ['ประเภทเอกสารไม่ถูกต้อง'] } });
		}

		// type1-3 require procurement_method; type4 and type5 don't
		const needsMethod = ['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel'].includes(doc_type);
		if (needsMethod && !procurement_method) {
			return fail(400, { success: false, errors: { procurement_method: ['กรุณาเลือกวิธีจัดซื้อจัดจ้าง'] } });
		}

		try {
			// Check no duplicate in-progress document for this plan
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

			// Create the document
			const { generateSlug } = await import('$lib/server/utils');
			const [newDoc] = await db
				.insert(documents)
				.values({
					slug: generateSlug(),
					agency_id,
					workflow_id: null,
					plan_id,
					current_step_id: null,
					payload: {},
					status: 'IN_PROGRESS',
					updated_by: locals.user?.sub || null,
					doc_type,
					procurement_method: procurement_method || null,
					phase: 'APPROVAL'
				})
				.returning();

			if (!newDoc) {
				return fail(500, { success: false, errors: { plan_id: ['ไม่สามารถสร้างเอกสารได้'] } });
			}

			// Create the 5 approval steps
			const { createApprovalSteps } = await import('$lib/server/approval-flow');
			await createApprovalSteps(newDoc.id, plan_id, locals.user?.sub, agency_id);

			return { success: true, message: 'สร้างเอกสารจัดซื้อจัดจ้างสำเร็จ — เข้าสู่ขั้นตอนอนุมัติ' };
		} catch (err) {
			console.error('Create document v2 error:', err);
			return fail(500, { success: false, errors: { plan_id: ['เกิดข้อผิดพลาด'] } });
		}
	}
};
