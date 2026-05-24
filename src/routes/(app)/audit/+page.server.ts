import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { provinces, agencies, fiscalYears } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getMongoDb } from '$lib/server/db/mongodb';
import { type AuditRecord, type AuditCollection, VALID_AUDIT_COLLECTIONS } from '$lib/server/validation/types';
import { getAgencyScope } from '$lib/server/auth/scope';

export const load: PageServerLoad = async ({ parent, url, cookies }) => {
	const { user } = await parent();
	const collectionParam = url.searchParams.get('collection') || 'plan_budget_histories';
	const collection: AuditCollection = VALID_AUDIT_COLLECTIONS.includes(collectionParam as AuditCollection)
		? (collectionParam as AuditCollection)
		: 'plan_budget_histories';

	const selectedAgencyId = getAgencyScope(user, cookies);

	const actionType = url.searchParams.get('action_type') || null;
	let records: AuditRecord[] = [];

	if (selectedAgencyId) {
		try {
			const mongoDB = await getMongoDb();
			const filter: Record<string, unknown> = {};

			if (user.is_super_admin) {
				// Super admin sees: records for selected agency + own edits
				filter.$or = [
					{ agency_id: selectedAgencyId },
					{ 'action_by.user_id': user.sub }
				];
			} else {
				// Regular user / director: only own agency records
				filter.agency_id = selectedAgencyId;
			}

			if (actionType) filter.action_type = actionType;

			const rawRecords = await mongoDB
				.collection(collection)
				.find(filter)
				.sort({ created_at: -1 })
				.limit(200)
				.toArray();

			records = rawRecords.map((r) => ({
				...r,
				_id: r._id.toString()
			})) as AuditRecord[];
		} catch (err) {
			console.error('Audit load error:', err);
			records = [];
		}
	}

	// Load fiscal years for filtering
	let fyList: { id: number; year_name: string; is_active: boolean }[] = [];
	if (selectedAgencyId) {
		fyList = await db
			.select({ id: fiscalYears.id, year_name: fiscalYears.year_name, is_active: fiscalYears.is_active })
			.from(fiscalYears)
			.where(eq(fiscalYears.agency_id, selectedAgencyId));
	}

	return {
		user,
		records,
		collection,
		fiscalYears: fyList,
		provinces: [] as { id: number; name: string }[],
		agencies: [] as { id: number; name: string; province_id: number }[],
		selectedProvinceId: null as number | null,
		selectedAgencyId,
		actionType
	};
};
