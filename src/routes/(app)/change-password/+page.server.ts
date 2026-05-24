import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '$lib/server/auth/password';
import { forceChangePasswordSchema, parseFormData } from '$lib/server/validation/schemas';
import { signAccessToken } from '$lib/server/auth/jwt';
import type { JWTPayload } from '$lib/types/auth';
import { dev } from '$app/environment';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	// If user doesn't need to change password, redirect to dashboard
	if (!locals.user.must_change_password) {
		throw redirect(303, '/dashboard');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		if (!locals.user) throw redirect(303, '/login');

		const parsed = parseFormData(forceChangePasswordSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		const { new_password } = parsed.data;

		try {
			const password_hash = await hashPassword(new_password);

			await db
				.update(users)
				.set({
					password_hash,
					must_change_password: false,
					updated_at: new Date()
				})
				.where(eq(users.id, locals.user.sub));

			// Rebuild JWT with must_change_password = false
			const updatedPayload: JWTPayload = {
				...locals.user,
				must_change_password: false
			};

			const newAccessToken = await signAccessToken(updatedPayload);
			cookies.set('accessToken', newAccessToken, {
				path: '/',
				httpOnly: true,
				secure: !dev,
				sameSite: 'lax',
				maxAge: 60 * 15
			});
		} catch (err) {
			console.error('Change password error:', err);
			return fail(500, { success: false, errors: { new_password: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}

		throw redirect(303, '/dashboard');
	}
};
