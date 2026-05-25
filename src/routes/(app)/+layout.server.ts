import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUnreadCount } from '$lib/server/notifications';
import { getPendingTaskCount, getPendingFinanceCount } from '$lib/server/step-assignments';
import { db } from '$lib/server/db';
import { documentApprovalSteps } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

async function getPendingDocumentCount(userId: number): Promise<number> {
	const rows = await db
		.select({ id: documentApprovalSteps.id })
		.from(documentApprovalSteps)
		.where(and(
			eq(documentApprovalSteps.assigned_user_id, userId),
			eq(documentApprovalSteps.status, 'IN_PROGRESS')
		));
	return rows.length;
}

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const u = locals.user;
	const [notificationCount, pendingTaskCount, pendingFinanceCount, pendingDocumentCount] = await Promise.all([
		getUnreadCount(u.sub),
		getPendingTaskCount(u.sub),
		getPendingFinanceCount(
			u.sub,
			u.agency_id,
			u.is_super_admin,
			u.is_director || false,
			u.permissions?.can_manage_finance || false
		),
		getPendingDocumentCount(u.sub)
	]);

	return { user: u, notificationCount, pendingTaskCount, pendingFinanceCount, pendingDocumentCount };
};
