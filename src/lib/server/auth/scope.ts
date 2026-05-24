import type { Cookies } from '@sveltejs/kit';
import type { JWTPayload } from '$lib/types/auth';

/**
 * Determine agency scope for the current user.
 * - Super admin: reads from `sa_agency` cookie (set via org-management page)
 * - Others: uses their own agency_id from JWT
 */
export function getAgencyScope(user: JWTPayload | null, cookies: Cookies): number | null {
	if (!user) return null;

	if (user.is_super_admin) {
		const cookieVal = cookies.get('sa_agency');
		return cookieVal ? Number(cookieVal) : null;
	}

	return user.agency_id;
}
