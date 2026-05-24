import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { provinces } from '$lib/server/db/schema';
import { provinceSchema, parseFormData } from '$lib/server/validation/schemas';

export const load: PageServerLoad = async () => {
	const allProvinces = await db.select().from(provinces).orderBy(provinces.name);
	return { provinces: allProvinces };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseFormData(provinceSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			await db.insert(provinces).values({ name: parsed.data.name });
			return { success: true };
		} catch (err) {
			console.error('Create province error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	update: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id || isNaN(id)) {
			return fail(400, { success: false, errors: { id: ['ไม่พบรหัสจังหวัด'] } });
		}

		const parsed = parseFormData(provinceSchema, formData);
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			await db.update(provinces).set({ name: parsed.data.name }).where(eq(provinces.id, id));
			return { success: true };
		} catch (err) {
			console.error('Update province error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	importCsv: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('csv_file') as File | null;
		if (!file || file.size === 0) return fail(400, { success: false, errors: { name: ['กรุณาเลือกไฟล์ CSV'] } });

		try {
			const text = await file.text();
			const { parseCsv } = await import('$lib/utils/format');
			const rows = parseCsv(text);
			if (rows.length === 0) return fail(400, { success: false, errors: { name: ['ไฟล์ CSV ว่างเปล่า'] } });

			const existing = await db.select().from(provinces);
			const existingNames = new Set(existing.map((p) => p.name.trim()));

			let created = 0;
			let skipped = 0;

			for (const row of rows) {
				const name = row['ชื่อจังหวัด']?.trim();
				if (!name) { skipped++; continue; }
				if (existingNames.has(name)) { skipped++; continue; }

				await db.insert(provinces).values({ name });
				existingNames.add(name);
				created++;
			}

			return { success: true, message: `นำเข้าสำเร็จ ${created} จังหวัด` + (skipped > 0 ? ` (ข้าม ${skipped} รายการ)` : '') };
		} catch (err) {
			console.error('Import CSV error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาดในการนำเข้า'] } });
		}
	},

	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id || isNaN(id)) {
			return fail(400, { success: false, errors: { id: ['ไม่พบรหัสจังหวัด'] } });
		}

		try {
			await db.delete(provinces).where(eq(provinces.id, id));
			return { success: true };
		} catch (err) {
			console.error('Delete province error:', err);
			return fail(500, { success: false, errors: { id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	}
};
