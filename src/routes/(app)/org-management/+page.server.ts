import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { provinces, agencies } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) throw redirect(303, '/login');
	const { is_super_admin, is_director } = locals.user;

	// Non-super-admin: auto-scope to their own agency
	if (!is_super_admin) {
		const agencyId = locals.user.agency_id;
		if (!agencyId) throw redirect(303, '/dashboard');

		const [agency] = await db
			.select({ id: agencies.id, name: agencies.name })
			.from(agencies)
			.where(eq(agencies.id, agencyId));

		const canManage = is_director || locals.user.permissions.can_manage_users;

		return {
			mode: canManage ? 'director' as const : 'viewer' as const,
			selectedAgencyId: agencyId,
			selectedProvinceId: null as number | null,
			agencyName: agency?.name ?? '',
			provinces: [],
			agencies: [],
			canManage
		};
	}

	// Super admin: read from cookies
	const provinceList = await db
		.select({ id: provinces.id, name: provinces.name })
		.from(provinces);

	const selectedProvinceId = cookies.get('sa_province')
		? Number(cookies.get('sa_province'))
		: null;

	let agencyList: { id: number; name: string }[] = [];
	let selectedAgencyId: number | null = cookies.get('sa_agency')
		? Number(cookies.get('sa_agency'))
		: null;

	if (selectedProvinceId) {
		agencyList = await db
			.select({ id: agencies.id, name: agencies.name })
			.from(agencies)
			.where(eq(agencies.province_id, selectedProvinceId));

		// Validate the selected agency belongs to selected province
		if (selectedAgencyId && !agencyList.some((a) => a.id === selectedAgencyId)) {
			selectedAgencyId = null;
			cookies.delete('sa_agency', { path: '/' });
		}
	} else {
		// No province selected, clear agency too
		selectedAgencyId = null;
	}

	return {
		mode: 'super_admin' as const,
		selectedProvinceId,
		selectedAgencyId,
		provinces: provinceList,
		agencies: agencyList,
		agencyName: null,
		canManage: true
	};
};

export const actions: Actions = {
	selectScope: async ({ request, cookies, locals }) => {
		if (!locals.user?.is_super_admin) return;

		const form = await request.formData();
		const provinceId = form.get('province_id')?.toString() || '';
		const agencyId = form.get('agency_id')?.toString() || '';

		if (provinceId) {
			cookies.set('sa_province', provinceId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 });
		} else {
			cookies.delete('sa_province', { path: '/' });
			cookies.delete('sa_agency', { path: '/' });
		}

		if (agencyId) {
			cookies.set('sa_agency', agencyId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 });
		} else {
			cookies.delete('sa_agency', { path: '/' });
		}
	}
};
