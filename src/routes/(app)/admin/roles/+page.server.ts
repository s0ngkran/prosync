import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { roles, userAssignments } from '$lib/server/db/schema';
import { roleSchema, parseFormData } from '$lib/server/validation/schemas';
import type { RolePermissions } from '$lib/server/validation/types';

const DEFAULT_PERMISSIONS: RolePermissions = {
	system: { can_manage_users: false, can_manage_org_units: false },
	planning: { can_view_plan: false, can_create_plan: false, can_edit_plan: false, can_delete_plan: false },
	procurement: { can_view_document: false, can_create_document: false, can_approve_document: false },
	finance: { can_view_dika: false, can_create_dika: false, can_approve_dika: false },
	audit: { can_view_audit_trail: false }
};

const PERM_LABELS: Record<string, Record<string, string>> = {
	system: { can_manage_users: 'จัดการผู้ใช้งาน', can_manage_org_units: 'จัดการโครงสร้างองค์กร' },
	planning: { can_view_plan: 'ดูแผนงาน', can_create_plan: 'สร้างแผน', can_edit_plan: 'แก้ไขแผน', can_delete_plan: 'ลบแผน' },
	procurement: { can_view_document: 'ดูเอกสารจัดซื้อ', can_create_document: 'สร้างเอกสารจัดซื้อ', can_approve_document: 'อนุมัติเอกสารจัดซื้อ' },
	finance: { can_view_dika: 'ดูฎีกาเบิกจ่าย', can_create_dika: 'สร้างฎีกาเบิกจ่าย', can_approve_dika: 'อนุมัติฎีกาเบิกจ่าย' },
	audit: { can_view_audit_trail: 'ดูประวัติการเปลี่ยนแปลง' }
};

function getLabelForPerm(group: string, key: string): string | undefined {
	return PERM_LABELS[group]?.[key];
}

function parsePermissions(formData: FormData): RolePermissions {
	const permissions = structuredClone(DEFAULT_PERMISSIONS);

	for (const [key] of formData.entries()) {
		if (!key.startsWith('perm.')) continue;
		const parts = key.replace('perm.', '').split('.');
		if (parts.length !== 2) continue;
		const [group, perm] = parts;
		if (
			group in permissions &&
			perm in permissions[group as keyof RolePermissions]
		) {
			(permissions[group as keyof RolePermissions] as Record<string, boolean>)[perm] = true;
		}
	}

	return permissions;
}

export const load: PageServerLoad = async () => {
	const allRoles = await db.select().from(roles).orderBy(roles.name);
	return { roles: allRoles };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const parsed = parseFormData(roleSchema, formData);
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const permissions = parsePermissions(formData);
			await db.insert(roles).values({ name: parsed.data.name, permissions });
			return { success: true };
		} catch (err) {
			console.error('Create role error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	update: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id || isNaN(id)) {
			return fail(400, { success: false, errors: { id: ['ไม่พบรหัสบทบาท'] } });
		}

		const parsed = parseFormData(roleSchema, formData);
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const permissions = parsePermissions(formData);
			await db.update(roles).set({ name: parsed.data.name, permissions }).where(eq(roles.id, id));
			return { success: true };
		} catch (err) {
			console.error('Update role error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
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
				return fail(400, { success: false, errors: { csv: ['ไฟล์ CSV ว่างเปล่า'] } });
			}

			let created = 0;
			const permKeys = Object.values(DEFAULT_PERMISSIONS);

			for (const row of rows) {
				const name = row['ชื่อบทบาท']?.trim();
				if (!name) continue;

				// Parse permissions from CSV columns
				const permissions = structuredClone(DEFAULT_PERMISSIONS);
				const permString = row['สิทธิ์']?.trim() || '';

				if (permString) {
					// Match permission labels to actual permission keys
					for (const [group, groupDef] of Object.entries(permissions)) {
						for (const key of Object.keys(groupDef)) {
							// Check if the Thai label appears in the permission string
							const label = getLabelForPerm(group, key);
							if (label && permString.includes(label)) {
								(permissions[group as keyof typeof permissions] as Record<string, boolean>)[key] = true;
							}
						}
					}
				}

				await db.insert(roles).values({ name, permissions });
				created++;
			}

			return { success: true, message: `นำเข้าสำเร็จ ${created} บทบาท` };
		} catch (err) {
			console.error('Import CSV error:', err);
			return fail(500, { success: false, errors: { csv: ['เกิดข้อผิดพลาดในการนำเข้า'] } });
		}
	},

	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id || isNaN(id)) {
			return fail(400, { success: false, errors: { id: ['ไม่พบรหัสบทบาท'] } });
		}

		try {
			await db.delete(userAssignments).where(eq(userAssignments.role_id, id));
			await db.delete(roles).where(eq(roles.id, id));
			return { success: true };
		} catch (err) {
			console.error('Delete role error:', err);
			return fail(500, { success: false, errors: { id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	}
};
