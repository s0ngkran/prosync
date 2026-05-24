import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, roles, agencies, provinces } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { mergePermissions } from '$lib/server/validation/types';
import { signAccessToken } from '$lib/server/auth/jwt';
import { dev } from '$app/environment';

function isSuperAdminOrImpersonating(locals: any, cookies: any): boolean {
	return locals.user?.is_super_admin || cookies.get('dev_impersonate') === 'true';
}

/** GET: list provinces, agencies, roles for the dev tool */
export const GET: RequestHandler = async ({ locals, cookies }) => {
	if (!isSuperAdminOrImpersonating(locals, cookies)) return json({ error: 'Forbidden' }, { status: 403 });

	const [provinceList, agencyList, roleList] = await Promise.all([
		db.select({ id: provinces.id, name: provinces.name }).from(provinces).orderBy(provinces.name),
		db.select({ id: agencies.id, name: agencies.name, province_id: agencies.province_id }).from(agencies).orderBy(agencies.name),
		db.select({ id: roles.id, name: roles.name, permissions: roles.permissions }).from(roles).orderBy(roles.name)
	]);

	return json({ provinces: provinceList, agencies: agencyList, roles: roleList });
};

/** POST: impersonate a role or reset */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!isSuperAdminOrImpersonating(locals, cookies)) return json({ error: 'Forbidden' }, { status: 403 });

	const body = await request.json();
	const { role_id, agency_id, reset } = body as {
		role_id?: number;
		agency_id?: number;
		reset?: boolean;
	};

	// Reset: restore original super admin token
	if (reset) {
		cookies.delete('dev_impersonate', { path: '/' });
		// Rebuild real super admin JWT
		const [realUser] = await db.select().from(users).where(eq(users.id, locals.user.sub));
		if (realUser) {
			const token = await signAccessToken({
				sub: realUser.id,
				id_card: realUser.id_card,
				name: realUser.name,
				position_rank: realUser.position_rank ?? null,
				profile_picture: realUser.profile_picture ?? null,
				agency_id: null,
				is_super_admin: true,
				is_director: false,
				must_change_password: false,
				profile_completed: true,
				primary_org_unit_id: null,
				permissions: {
					can_manage_users: true,
					can_manage_plans: true,
					can_manage_procurement: true,
					can_manage_finance: true,
					can_view_audit_trail: true,
					can_view_plans: true,
					can_view_procurement: true,
					can_view_finance: true,
					can_view_dashboard: true
				}
			});
			cookies.set('accessToken', token, { path: '/', httpOnly: true, secure: !dev, sameSite: 'lax', maxAge: 60 * 15 });
		}
		return json({ ok: true, message: 'กลับเป็น Super Admin แล้ว' });
	}

	// Impersonate by role + agency
	if (role_id && agency_id) {
		const [role] = await db.select().from(roles).where(eq(roles.id, role_id));
		if (!role) return json({ error: 'ไม่พบบทบาท' }, { status: 404 });

		const { permissions: merged } = mergePermissions([
			{ permissions: role.permissions, org_unit_id: 1, is_primary_unit: true }
		]);

		const token = await signAccessToken({
			sub: locals.user.sub,
			id_card: locals.user.id_card,
			name: `[DEV] ${role.name}`,
			position_rank: role.name,
			profile_picture: null,
			agency_id,
			is_super_admin: false,
			is_director: false,
			must_change_password: false,
			profile_completed: true,
			primary_org_unit_id: null,
			permissions: merged
		});

		cookies.set('accessToken', token, { path: '/', httpOnly: true, secure: !dev, sameSite: 'lax', maxAge: 60 * 15 });
		cookies.set('dev_impersonate', 'true', { path: '/', httpOnly: true, maxAge: 60 * 15 });
		cookies.set('sa_agency', String(agency_id), { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 });

		return json({ ok: true, message: `สวมบทบาท "${role.name}"` });
	}

	return json({ error: 'ต้องระบุ role_id + agency_id' }, { status: 400 });
};
