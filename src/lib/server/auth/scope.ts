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

/**
 * Get province scope for super admin from cookie.
 */
export function getProvinceScope(user: JWTPayload | null, cookies: Cookies): number | null {
	if (!user?.is_super_admin) return null;
	const val = cookies.get('sa_province');
	return val ? Number(val) : null;
}

/**
 * Load province + agency lists for super admin scope selectors.
 */
export async function loadScopeData(
	user: JWTPayload | null,
	cookies: Cookies,
	db: any,
	provincesTable: any,
	agenciesTable: any,
	eq: any
): Promise<{
	provinces: { id: number; name: string }[];
	agencies: any[];
	selectedProvinceId: number | null;
	selectedAgencyId: number | null;
}> {
	const selectedAgencyId = getAgencyScope(user, cookies);

	if (!user?.is_super_admin) {
		return { provinces: [], agencies: [], selectedProvinceId: null, selectedAgencyId };
	}

	const provinceList = await db.select({ id: provincesTable.id, name: provincesTable.name }).from(provincesTable).orderBy(provincesTable.name);
	const selectedProvinceId = getProvinceScope(user, cookies);

	let agencyList: any[] = [];
	if (selectedProvinceId) {
		agencyList = await db
			.select({ id: agenciesTable.id, name: agenciesTable.name, agency_type: agenciesTable.agency_type, province_id: agenciesTable.province_id })
			.from(agenciesTable)
			.where(eq(agenciesTable.province_id, selectedProvinceId));
	}

	return { provinces: provinceList, agencies: agencyList, selectedProvinceId, selectedAgencyId };
}
