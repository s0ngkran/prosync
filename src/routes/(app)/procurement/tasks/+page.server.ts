import type { PageServerLoad } from './$types';
import { getPendingTasks } from '$lib/server/step-assignments';
import { db } from '$lib/server/db';
import { documents, plans, paymentRounds } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAgencyScope } from '$lib/server/auth/scope';

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const { user } = await parent();
	const agencyId = getAgencyScope(user, cookies);

	// Legacy tasks (old workflow system)
	const legacyTasks = await getPendingTasks(user.sub);
	const grouped = {
		APPROVER: legacyTasks.filter((t) => t.assignment_type === 'APPROVER'),
		UPLOADER: legacyTasks.filter((t) => t.assignment_type === 'UPLOADER'),
		COMMITTEE_MEMBER: legacyTasks.filter((t) => t.assignment_type === 'COMMITTEE_MEMBER'),
		SCORER: legacyTasks.filter((t) => t.assignment_type === 'SCORER')
	};

	// V2 tasks: payment rounds in EXECUTION phase that need procurement action
	let v2Tasks: any[] = [];
	if (agencyId) {
		// Get documents in execution phase for this agency (type1/2/3 only)
		const execDocs = await db
			.select({
				id: documents.id, slug: documents.slug,
				plan_id: documents.plan_id,
				plan_title: plans.title,
				doc_type: documents.doc_type,
				procurement_method: documents.procurement_method,
				phase: documents.phase
			})
			.from(documents)
			.innerJoin(plans, eq(documents.plan_id, plans.id))
			.where(and(
				eq(documents.agency_id, agencyId),
				eq(documents.phase, 'EXECUTION'),
				inArray(documents.doc_type, ['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel'])
			));

		// Get payment rounds that need procurement action
		for (const doc of execDocs) {
			const rounds = await db
				.select()
				.from(paymentRounds)
				.where(and(
					eq(paymentRounds.document_id, doc.id),
					inArray(paymentRounds.status, ['BILL_PENDING', 'BILL_CREATED'])
				));

			for (const round of rounds) {
				v2Tasks.push({
					document_id: doc.id, document_slug: doc.slug,
					plan_title: doc.plan_title,
					doc_type: doc.doc_type,
					procurement_method: doc.procurement_method,
					round_id: round.id,
					round_number: round.round_number,
					round_status: round.status,
					bill_payload: round.bill_payload,
					created_at: round.created_at
				});
			}
		}
	}

	return {
		user,
		// Legacy
		tasks: legacyTasks,
		grouped,
		// V2
		v2Tasks
	};
};
