import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	documents,
	plans,
	fiscalYears,
	agencies,
	provinces,
	documentApprovalSteps,
	users,
	orgUnits
} from '$lib/server/db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { getAgencyScope, loadScopeData } from '$lib/server/auth/scope';

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const { user } = await parent();
	const agencyId = getAgencyScope(user, cookies);

	let documentList: any[] = [];
	let leafPlanList: any[] = [];
	let fyList: any[] = [];
	let pendingTasks: any[] = [];

	if (agencyId) {
		fyList = await db
			.select({ id: fiscalYears.id, year_name: fiscalYears.year_name, is_active: fiscalYears.is_active })
			.from(fiscalYears)
			.where(eq(fiscalYears.agency_id, agencyId));

		// Load v2 documents (with doc_type set)
		documentList = await db
			.select({
				id: documents.id, slug: documents.slug,
				agency_id: documents.agency_id,
				plan_id: documents.plan_id,
				plan_title: plans.title,
				fiscal_year_id: plans.fiscal_year_id,
				status: documents.status,
				doc_type: documents.doc_type,
				procurement_method: documents.procurement_method,
				phase: documents.phase,
				updated_by: documents.updated_by
			})
			.from(documents)
			.innerJoin(plans, eq(documents.plan_id, plans.id))
			.where(and(eq(documents.agency_id, agencyId), eq(documents.phase, 'APPROVAL')))
			.orderBy(desc(documents.id));

		// Also load EXECUTION/COMPLETED documents for reference
		const otherDocs = await db
			.select({
				id: documents.id, slug: documents.slug,
				agency_id: documents.agency_id,
				plan_id: documents.plan_id,
				plan_title: plans.title,
				fiscal_year_id: plans.fiscal_year_id,
				status: documents.status,
				doc_type: documents.doc_type,
				procurement_method: documents.procurement_method,
				phase: documents.phase,
				updated_by: documents.updated_by
			})
			.from(documents)
			.innerJoin(plans, eq(documents.plan_id, plans.id))
			.where(and(
				eq(documents.agency_id, agencyId),
				inArray(documents.phase, ['EXECUTION', 'COMPLETED'])
			))
			.orderBy(desc(documents.id));

		documentList = [...documentList, ...otherDocs];

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

		// Load pending approval tasks for current user
		const allApprovalSteps = await db
			.select({
				id: documentApprovalSteps.id,
				document_id: documentApprovalSteps.document_id,
				step_sequence: documentApprovalSteps.step_sequence,
				step_code: documentApprovalSteps.step_code,
				step_name: documentApprovalSteps.step_name,
				assigned_user_id: documentApprovalSteps.assigned_user_id,
				status: documentApprovalSteps.status,
				created_at: documentApprovalSteps.created_at
			})
			.from(documentApprovalSteps)
			.where(and(
				eq(documentApprovalSteps.assigned_user_id, user.sub),
				eq(documentApprovalSteps.status, 'IN_PROGRESS')
			));

		// Enrich with document info
		for (const step of allApprovalSteps) {
			const doc = documentList.find((d: any) => d.id === step.document_id);
			if (doc) {
				pendingTasks.push({
					...step,
					document_slug: doc.slug,
					plan_title: doc.plan_title,
					doc_type: doc.doc_type
				});
			}
		}
	}

	const orgUnitList = agencyId
		? await db.select().from(orgUnits).where(eq(orgUnits.agency_id, agencyId))
		: [];

	return {
		user,
		documents: documentList,
		leafPlans: leafPlanList,
		fiscalYears: fyList,
		pendingTasks,
		orgUnits: orgUnitList,
		...(await loadScopeData(user, cookies, db, provinces, agencies, eq)),
		selectedAgencyId: agencyId
	};
};

export const actions: Actions = {
	createDocument: async ({ request, locals }) => {
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

		// type1/2/3 require procurement_method
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

			const { createApprovalSteps } = await import('$lib/server/approval-flow');
			await createApprovalSteps(newDoc.id, plan_id, locals.user?.sub, agency_id);

			return { success: true, message: 'สร้างเอกสารจัดซื้อจัดจ้างสำเร็จ' };
		} catch (err) {
			console.error('Create document error:', err);
			return fail(500, { success: false, errors: { plan_id: ['เกิดข้อผิดพลาด'] } });
		}
	}
};
