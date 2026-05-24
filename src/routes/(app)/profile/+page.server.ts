import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, agencies, orgUnits, userAssignments, roles } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { verifyPassword, hashPassword } from '$lib/server/auth/password';
import { changePasswordSchema, parseFormData } from '$lib/server/validation/schemas';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	// Load full user record
	const [fullUser] = await db
		.select({
			id: users.id,
			id_card: users.id_card,
			name: users.name,
			email: users.email,
			phone: users.phone,
			position: users.position,
			position_rank: users.position_rank,
			profile_picture: users.profile_picture,
			agency_id: users.agency_id,
			is_super_admin: users.is_super_admin,
			profile_completed: users.profile_completed
		})
		.from(users)
		.where(eq(users.id, user.sub));

	// Load agency name
	let agencyName = '';
	if (fullUser?.agency_id) {
		const [agency] = await db
			.select({ name: agencies.name })
			.from(agencies)
			.where(eq(agencies.id, fullUser.agency_id));
		agencyName = agency?.name ?? '';
	}

	// Load role + org unit
	let roleName = '';
	let orgUnitName = '';
	const assignments = await db
		.select({
			role_name: roles.name,
			org_unit_name: orgUnits.name
		})
		.from(userAssignments)
		.innerJoin(roles, eq(userAssignments.role_id, roles.id))
		.innerJoin(orgUnits, eq(userAssignments.org_unit_id, orgUnits.id))
		.where(and(eq(userAssignments.user_id, user.sub), eq(userAssignments.is_primary_unit, true)))
		.limit(1);

	if (assignments.length > 0) {
		roleName = assignments[0].role_name;
		orgUnitName = assignments[0].org_unit_name;
	}

	return {
		user,
		profile: fullUser,
		agencyName,
		roleName,
		orgUnitName
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'ไม่ได้เข้าสู่ระบบ' });

		const form = await request.formData();
		const position = form.get('position')?.toString().trim();
		const name = form.get('name')?.toString().trim();
		const positionRank = form.get('position_rank')?.toString().trim();
		const email = form.get('email')?.toString().trim();
		const phone = form.get('phone')?.toString().trim();

		if (!name) return fail(400, { error: 'กรุณากรอกชื่อ-นามสกุล' });

		// ผอ./รองผอ. cannot change their own position_rank
		const canEditRank = !locals.user.is_director && !locals.user.is_super_admin;

		try {
			const updateData: Record<string, any> = {
				position: position || null,
				name,
				email: email || null,
				phone: phone || null
			};

			if (canEditRank && positionRank !== undefined) {
				updateData.position_rank = positionRank || null;
			}

			await db
				.update(users)
				.set(updateData)
				.where(eq(users.id, locals.user.sub));

			return { success: true, message: 'อัปเดตโปรไฟล์สำเร็จ' };
		} catch (err) {
			console.error('Update profile error:', err);
			return fail(500, { error: 'เกิดข้อผิดพลาด' });
		}
	},

	changePassword: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'ไม่ได้เข้าสู่ระบบ' });

		const parsed = parseFormData(changePasswordSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		const { old_password, new_password } = parsed.data;

		try {
			const [user] = await db
				.select({ password_hash: users.password_hash })
				.from(users)
				.where(eq(users.id, locals.user.sub));

			if (!user) return fail(400, { success: false, errors: { old_password: ['ไม่พบผู้ใช้'] } });

			const valid = await verifyPassword(user.password_hash, old_password);
			if (!valid) {
				return fail(400, { success: false, errors: { old_password: ['รหัสผ่านปัจจุบันไม่ถูกต้อง'] } });
			}

			const password_hash = await hashPassword(new_password);
			await db
				.update(users)
				.set({ password_hash, updated_at: new Date() })
				.where(eq(users.id, locals.user.sub));

			return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
		} catch (err) {
			console.error('Change password error:', err);
			return fail(500, { success: false, errors: { old_password: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	uploadAvatar: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'ไม่ได้เข้าสู่ระบบ' });

		const form = await request.formData();
		const file = form.get('avatar') as File | null;

		if (!file || file.size === 0) {
			return fail(400, { error: 'กรุณาเลือกรูปภาพ' });
		}

		if (file.size > 5 * 1024 * 1024) {
			return fail(400, { error: 'ไฟล์ต้องมีขนาดไม่เกิน 5MB' });
		}

		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			return fail(400, { error: 'รองรับเฉพาะ JPG, PNG, WEBP' });
		}

		try {
			const { writeFileSync, mkdirSync, existsSync } = await import('fs');
			const { join } = await import('path');

			const uploadDir = join('static', 'uploads', 'avatars');
			if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

			const ext = file.name.split('.').pop() || 'jpg';
			const filename = `user_${locals.user.sub}_${Date.now()}.${ext}`;
			const filePath = join(uploadDir, filename);
			const publicPath = `/uploads/avatars/${filename}`;

			const buffer = Buffer.from(await file.arrayBuffer());
			writeFileSync(filePath, buffer);

			await db
				.update(users)
				.set({ profile_picture: publicPath })
				.where(eq(users.id, locals.user.sub));

			return { success: true, message: 'อัปเดตรูปโปรไฟล์สำเร็จ' };
		} catch (err) {
			console.error('Upload avatar error:', err);
			return fail(500, { error: 'เกิดข้อผิดพลาดในการอัปโหลด' });
		}
	}
};
