import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { agencies, provinces } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';
import { createAgencySchema, updateAgencySchema, parseFormData } from '$lib/server/validation/schemas';

export const load: PageServerLoad = async () => {
	const agencyList = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			agency_type: agencies.agency_type,
			province_id: agencies.province_id,
			province_name: provinces.name
		})
		.from(agencies)
		.leftJoin(provinces, eq(agencies.province_id, provinces.id))
		.orderBy(agencies.name);

	const provinceList = await db
		.select({ id: provinces.id, name: provinces.name })
		.from(provinces)
		.orderBy(provinces.name);

	return { agencies: agencyList, provinces: provinceList };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseFormData(createAgencySchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: Object.values(parsed.errors)[0]?.[0] || 'ข้อมูลไม่ถูกต้อง' });
		}

		try {
			await db.insert(agencies).values(parsed.data);
			return { success: true };
		} catch (err) {
			console.error('Create agency error:', err);
			return fail(500, { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
		}
	},

	update: async ({ request }) => {
		const parsed = parseFormData(updateAgencySchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { error: Object.values(parsed.errors)[0]?.[0] || 'ข้อมูลไม่ถูกต้อง' });
		}

		try {
			const { id, ...data } = parsed.data;
			await db.update(agencies).set(data).where(eq(agencies.id, id));
			return { success: true };
		} catch (err) {
			console.error('Update agency error:', err);
			return fail(500, { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
		}
	},

	importCsv: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('csv_file') as File | null;
		if (!file || file.size === 0) return fail(400, { error: 'กรุณาเลือกไฟล์ CSV' });

		try {
			const text = await file.text();
			const { parseCsv } = await import('$lib/utils/format');
			const rows = parseCsv(text);
			if (rows.length === 0) return fail(400, { error: 'ไฟล์ CSV ว่างเปล่า' });

			const allProvinces = await db.select().from(provinces);
			const provMap = new Map(allProvinces.map((p) => [p.name.trim(), p.id]));

			let created = 0;
			let skipped = 0;

			for (const row of rows) {
				const name = row['ชื่อหน่วยงาน']?.trim();
				const agencyType = row['ประเภท']?.trim();
				const provinceName = row['จังหวัด']?.trim();

				if (!name || !agencyType || !provinceName) { skipped++; continue; }

				const provinceId = provMap.get(provinceName);
				if (!provinceId) { skipped++; continue; }

				await db.insert(agencies).values({
					name,
					agency_type: agencyType,
					province_id: provinceId
				});
				created++;
			}

			const msg = `นำเข้าสำเร็จ ${created} หน่วยงาน` + (skipped > 0 ? ` (ข้าม ${skipped} รายการ)` : '');
			return { success: true, message: msg };
		} catch (err) {
			console.error('Import CSV error:', err);
			return fail(500, { error: 'เกิดข้อผิดพลาดในการนำเข้า' });
		}
	},

	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!id || isNaN(id)) {
			return fail(400, { error: 'ไม่พบหน่วยงานที่ต้องการลบ' });
		}

		try {
			await db.delete(agencies).where(eq(agencies.id, id));
			return { success: true };
		} catch (err) {
			console.error('Delete agency error:', err);
			return fail(500, { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
		}
	}
};
