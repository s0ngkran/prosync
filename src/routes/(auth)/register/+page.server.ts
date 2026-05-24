import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { hashPassword } from '$lib/server/auth/password';
import { registerSchema, parseFormData } from '$lib/server/validation/schemas';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const parsed = parseFormData(registerSchema, formData);

		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		const { id_card, password, name, email, position, position_rank } = parsed.data;

		try {
			// Check if user already exists
			const [existingUser] = await db
				.select()
				.from(users)
				.where(eq(users.id_card, id_card));

			if (existingUser) {
				return fail(400, {
					success: false,
					errors: { id_card: ['เลขบัตรประชาชนนี้ถูกใช้งานแล้ว'] }
				});
			}

			// Hash password
			const passwordHash = await hashPassword(password);

			// Create user
			const [newUser] = await db
				.insert(users)
				.values({
					id_card,
					password_hash: passwordHash,
					name,
					email: email || null,
					position: position || null,
					position_rank: position_rank || null,
					is_super_admin: false,
					must_change_password: false
				})
				.returning();

			if (!newUser) {
				throw new Error('Failed to create user');
			}

			// Auto login after registration
			const { signAccessToken, signRefreshToken } = await import('$lib/server/auth/jwt');
			const { mergePermissions } = await import('$lib/server/validation/types');
			const { roles, userAssignments } = await import('$lib/server/db/schema');

			let primaryOrgUnitId: number | null = null;
			let merged = {
				can_manage_users: false,
				can_manage_plans: false,
				can_manage_procurement: false,
				can_manage_finance: false,
				can_view_audit_trail: false,
				can_view_plans: false,
				can_view_procurement: false,
				can_view_finance: false,
				can_view_dashboard: false
			};

			const assignments = await db
				.select({
					permissions: roles.permissions,
					org_unit_id: userAssignments.org_unit_id,
					is_primary_unit: userAssignments.is_primary_unit
				})
				.from(userAssignments)
				.innerJoin(roles, eq(userAssignments.role_id, roles.id))
				.where(eq(userAssignments.user_id, newUser.id));

			if (assignments.length > 0) {
				const result = mergePermissions(assignments);
				merged = result.permissions;
				primaryOrgUnitId = result.primaryOrgUnitId;
			}

			const jwtPayload = {
				sub: newUser.id,
				id_card: newUser.id_card,
				name: newUser.name,
				position_rank: null,
				profile_picture: null,
				agency_id: newUser.agency_id,
				is_super_admin: newUser.is_super_admin,
				is_director: false,
				must_change_password: false,
				profile_completed: false,
				primary_org_unit_id: primaryOrgUnitId,
				permissions: merged
			};

			const accessToken = await signAccessToken(jwtPayload);
			const refreshToken = await signRefreshToken(newUser.id);

			const { dev } = await import('$app/environment');

			cookies.set('accessToken', accessToken, {
				path: '/',
				httpOnly: true,
				secure: !dev,
				sameSite: 'lax',
				maxAge: 60 * 15
			});

			cookies.set('refreshToken', refreshToken, {
				path: '/',
				httpOnly: true,
				secure: !dev,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7
			});
		} catch (err) {
			console.error('Registration error:', err);
			return fail(500, {
				success: false,
				errors: { id_card: ['เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'] }
			});
		}

		throw redirect(303, '/dashboard');
	}
};
