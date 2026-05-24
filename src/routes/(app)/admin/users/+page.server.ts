import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, userAssignments, roles, orgUnits, agencies, hireTypes } from '$lib/server/db/schema';
import { eq, and, isNull, like, or } from 'drizzle-orm';
import { hashPassword } from '$lib/server/auth/password';
import {
	createUserSchema,
	updateUserSchema,
	assignRoleSchema,
	resetPasswordSchema,
	parseFormData
} from '$lib/server/validation/schemas';

export const load: PageServerLoad = async ({ url, locals }) => {
	const search = url.searchParams.get('search') || '';

	// Determine agency scope
	let agencyFilter: number | null = null;
	if (locals.user?.is_super_admin) {
		const aidParam = url.searchParams.get('agency_id');
		if (aidParam) agencyFilter = Number(aidParam);
	} else if (locals.user?.is_director || locals.user?.permissions.can_manage_users) {
		agencyFilter = locals.user.agency_id;
	}

	// Build search + agency conditions
	const conditions = [isNull(users.deleted_at)];
	if (search) {
		conditions.push(or(like(users.name, `%${search}%`), like(users.id_card, `%${search}%`))!);
	}
	if (agencyFilter) {
		conditions.push(eq(users.agency_id, agencyFilter));
	}

	const userList = await db
		.select({
			id: users.id,
			prefix: users.prefix,
			name: users.name,
			id_card: users.id_card,
			position: users.position,
			position_rank: users.position_rank,
			email: users.email,
			birth: users.birth,
			hire_date: users.hire_date,
			hire_type_id: users.hire_type_id,
			division_id: users.division_id,
			agency_id: users.agency_id,
			agency_name: agencies.name,
			is_super_admin: users.is_super_admin,
			status: users.status
		})
		.from(users)
		.leftJoin(agencies, eq(users.agency_id, agencies.id))
		.where(and(...conditions));

	// Assignments — scoped by agency via org_unit
	const assignmentConditions = agencyFilter
		? eq(orgUnits.agency_id, agencyFilter)
		: undefined;

	const allAssignments = agencyFilter
		? await db
				.select({
					id: userAssignments.id,
					user_id: userAssignments.user_id,
					role_id: userAssignments.role_id,
					role_name: roles.name,
					org_unit_id: userAssignments.org_unit_id,
					org_unit_name: orgUnits.name,
					is_primary_unit: userAssignments.is_primary_unit
				})
				.from(userAssignments)
				.innerJoin(roles, eq(userAssignments.role_id, roles.id))
				.innerJoin(orgUnits, eq(userAssignments.org_unit_id, orgUnits.id))
				.where(eq(orgUnits.agency_id, agencyFilter))
		: await db
				.select({
					id: userAssignments.id,
					user_id: userAssignments.user_id,
					role_id: userAssignments.role_id,
					role_name: roles.name,
					org_unit_id: userAssignments.org_unit_id,
					org_unit_name: orgUnits.name,
					is_primary_unit: userAssignments.is_primary_unit
				})
				.from(userAssignments)
				.innerJoin(roles, eq(userAssignments.role_id, roles.id))
				.innerJoin(orgUnits, eq(userAssignments.org_unit_id, orgUnits.id));

	const allRoles = await db.select().from(roles);

	// Org units scoped by agency
	const allOrgUnits = agencyFilter
		? await db.select().from(orgUnits).where(eq(orgUnits.agency_id, agencyFilter))
		: await db.select().from(orgUnits);

	const allAgencies = await db.select().from(agencies);
	const allHireTypes = await db.select().from(hireTypes);

	return {
		users: userList,
		assignments: allAssignments,
		roles: allRoles,
		orgUnits: allOrgUnits,
		agencies: allAgencies,
		hireTypes: allHireTypes,
		search,
		agencyFilter
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseFormData(createUserSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { prefix, name, id_card, password, agency_id, position, position_rank, email, birth, hire_date, hire_type_id, division_id } = parsed.data;
			const password_hash = await hashPassword(password);

			await db.insert(users).values({
				prefix: prefix ?? null,
				name,
				id_card,
				password_hash,
				agency_id: agency_id ?? null,
				position: position ?? null,
				position_rank: position_rank ?? null,
				email: email ?? null,
				birth: birth ? new Date(birth) : null,
				hire_date: hire_date ? new Date(hire_date) : null,
				hire_type_id: hire_type_id ?? null,
				division_id: division_id ?? null,
				must_change_password: true,
				profile_completed: true
			});

			return { success: true, message: 'สร้างผู้ใช้งานสำเร็จ' };
		} catch (err) {
			console.error('Create user error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	update: async ({ request }) => {
		const parsed = parseFormData(updateUserSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { id, prefix, name, agency_id, position, position_rank, email, birth, hire_date, hire_type_id, division_id } = parsed.data;

			await db
				.update(users)
				.set({
					prefix: prefix ?? null,
					name,
					agency_id: agency_id ?? null,
					position: position ?? null,
					position_rank: position_rank ?? null,
					email: email ?? null,
					birth: birth ? new Date(birth) : null,
					hire_date: hire_date ? new Date(hire_date) : null,
					hire_type_id: hire_type_id ?? null,
					division_id: division_id ?? null,
					updated_at: new Date()
				})
				.where(eq(users.id, id));

			return { success: true, message: 'แก้ไขผู้ใช้งานสำเร็จ' };
		} catch (err) {
			console.error('Update user error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));

		if (!id || isNaN(id)) {
			return fail(400, { success: false, errors: { id: ['ไม่พบผู้ใช้งาน'] } });
		}

		try {
			await db.update(users).set({ deleted_at: new Date() }).where(eq(users.id, id));
			return { success: true, message: 'ลบผู้ใช้งานสำเร็จ' };
		} catch (err) {
			console.error('Delete user error:', err);
			return fail(500, { success: false, errors: { id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	assign: async ({ request }) => {
		const parsed = parseFormData(assignRoleSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { user_id, role_id, org_unit_id, is_primary_unit } = parsed.data;

			if (is_primary_unit) {
				await db
					.update(userAssignments)
					.set({ is_primary_unit: false })
					.where(eq(userAssignments.user_id, user_id));
			}

			await db.insert(userAssignments).values({
				user_id,
				role_id,
				org_unit_id,
				is_primary_unit
			});

			return { success: true, message: 'มอบหมายสิทธิ์สำเร็จ' };
		} catch (err) {
			console.error('Assign role error:', err);
			return fail(500, { success: false, errors: { role_id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	resetPassword: async ({ request }) => {
		const parsed = parseFormData(resetPasswordSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { user_id, new_password } = parsed.data;
			const password_hash = await hashPassword(new_password);

			await db
				.update(users)
				.set({
					password_hash,
					must_change_password: true,
					updated_at: new Date()
				})
				.where(eq(users.id, user_id));

			return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ ผู้ใช้จะถูกบังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งถัดไป' };
		} catch (err) {
			console.error('Reset password error:', err);
			return fail(500, { success: false, errors: { new_password: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	importCsv: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('csv_file') as File | null;

		if (!file || file.size === 0) {
			return fail(400, { success: false, errors: { csv: ['กรุณาเลือกไฟล์ CSV'] } });
		}

		try {
			const text = await file.text();
			const { parseCsv } = await import('$lib/utils/format');
			const rows = parseCsv(text);

			if (rows.length === 0) {
				return fail(400, { success: false, errors: { csv: ['ไฟล์ CSV ว่างเปล่าหรือรูปแบบไม่ถูกต้อง'] } });
			}

			let created = 0;
			let skipped = 0;
			const errors: string[] = [];

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				const rowNum = i + 2; // +2 because header is row 1
				const name = row['ชื่อ-สกุล']?.trim();
				const id_card = row['เลขบัตรประชาชน']?.trim();
				const password = row['รหัสผ่าน']?.trim() || id_card?.slice(-6) || '123456';

				if (!name || !id_card) {
					errors.push(`แถว ${rowNum}: ต้องระบุชื่อ-สกุลและเลขบัตรประชาชน`);
					skipped++;
					continue;
				}

				if (!/^\d{13}$/.test(id_card)) {
					errors.push(`แถว ${rowNum}: เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก`);
					skipped++;
					continue;
				}

				// Check duplicate
				const [existing] = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.id_card, id_card))
					.limit(1);

				if (existing) {
					skipped++;
					continue;
				}

				const password_hash = await hashPassword(password);

				await db.insert(users).values({
					prefix: row['คำนำหน้า']?.trim() || null,
					name,
					id_card,
					password_hash,
					agency_id: row['หน่วยงาน_id'] ? Number(row['หน่วยงาน_id']) : null,
					position: row['ยศ/คำนำหน้า']?.trim() || null,
					position_rank: row['ระดับตำแหน่ง']?.trim() || null,
					email: row['อีเมล']?.trim() || null,
					phone: row['เบอร์โทร']?.trim() || null,
					birth: row['วันเกิด']?.trim() ? new Date(row['วันเกิด']) : null,
					hire_date: row['วันบรรจุ']?.trim() ? new Date(row['วันบรรจุ']) : null,
					hire_type_id: row['ประเภทบรรจุ_id'] ? Number(row['ประเภทบรรจุ_id']) : null,
					division_id: row['แผนก_id'] ? Number(row['แผนก_id']) : null,
					must_change_password: true,
					profile_completed: true
				});

				created++;
			}

			const msg = `นำเข้าสำเร็จ ${created} รายการ` + (skipped > 0 ? ` (ข้าม ${skipped} รายการ)` : '');
			return { success: true, message: msg, importErrors: errors.length > 0 ? errors : undefined };
		} catch (err) {
			console.error('Import CSV error:', err);
			return fail(500, { success: false, errors: { csv: ['เกิดข้อผิดพลาดในการนำเข้า'] } });
		}
	},

	removeAssignment: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));

		if (!id || isNaN(id)) {
			return fail(400, { success: false, errors: { id: ['ไม่พบสิทธิ์'] } });
		}

		try {
			await db.delete(userAssignments).where(eq(userAssignments.id, id));
			return { success: true, message: 'ลบสิทธิ์สำเร็จ' };
		} catch (err) {
			console.error('Remove assignment error:', err);
			return fail(500, { success: false, errors: { id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	}
};
