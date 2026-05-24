import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { medianPrices, medianPriceCategories, medianPriceUnits, provinces } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createMedianPriceSchema, updateMedianPriceSchema, parseFormData } from '$lib/server/validation/schemas';
import { z } from 'zod';

export const load: PageServerLoad = async ({ url }) => {
	const provinceIdParam = url.searchParams.get('province_id');
	const selectedProvinceId = provinceIdParam ? Number(provinceIdParam) : null;

	const provinceList = await db.select().from(provinces).orderBy(provinces.name);
	const categoryList = await db.select().from(medianPriceCategories).orderBy(medianPriceCategories.name);
	const unitList = await db.select().from(medianPriceUnits).orderBy(medianPriceUnits.name);

	let prices: any[] = [];
	let selectedProvinceName: string | null = null;

	if (selectedProvinceId) {
		const found = provinceList.find((p) => p.id === selectedProvinceId);
		selectedProvinceName = found?.name ?? null;

		prices = await db
			.select({
				id: medianPrices.id,
				category_id: medianPrices.category_id,
				category_name: medianPriceCategories.name,
				item_name: medianPrices.item_name,
				unit_id: medianPrices.unit_id,
				unit_name: medianPriceUnits.name,
				price: medianPrices.price,
				province_id: medianPrices.province_id,
				effective_date: medianPrices.effective_date
			})
			.from(medianPrices)
			.innerJoin(medianPriceCategories, eq(medianPrices.category_id, medianPriceCategories.id))
			.leftJoin(medianPriceUnits, eq(medianPrices.unit_id, medianPriceUnits.id))
			.where(eq(medianPrices.province_id, selectedProvinceId));
	}

	return {
		prices,
		provinces: provinceList,
		categories: categoryList,
		units: unitList,
		selectedProvinceId,
		selectedProvinceName
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const parsed = parseFormData(createMedianPriceSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			await db.insert(medianPrices).values({
				...parsed.data,
				unit_id: parsed.data.unit_id ?? null
			});
			return { success: true, message: 'เพิ่มราคากลางสำเร็จ' };
		} catch (err) {
			console.error('Create median price error:', err);
			return fail(500, { success: false, errors: { item_name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	update: async ({ request }) => {
		const parsed = parseFormData(updateMedianPriceSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { success: false, errors: parsed.errors });
		}

		try {
			const { id, ...data } = parsed.data;
			await db.update(medianPrices).set({
				...data,
				unit_id: data.unit_id ?? null
			}).where(eq(medianPrices.id, id));
			return { success: true, message: 'แก้ไขราคากลางสำเร็จ' };
		} catch (err) {
			console.error('Update median price error:', err);
			return fail(500, { success: false, errors: { item_name: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id || isNaN(id)) return fail(400, { success: false, errors: { id: ['ไม่พบราคากลาง'] } });

		try {
			await db.delete(medianPrices).where(eq(medianPrices.id, id));
			return { success: true, message: 'ลบราคากลางสำเร็จ' };
		} catch (err) {
			console.error('Delete median price error:', err);
			return fail(500, { success: false, errors: { id: ['เกิดข้อผิดพลาด กรุณาลองใหม่'] } });
		}
	},

	createCategory: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim();
		if (!name) return fail(400, { success: false, errors: { name: ['กรุณากรอกชื่อหมวดหมู่'] } });

		try {
			await db.insert(medianPriceCategories).values({ name });
			return { success: true, message: 'เพิ่มหมวดหมู่สำเร็จ' };
		} catch (err) {
			console.error('Create category error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด'] } });
		}
	},

	createUnit: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim();
		if (!name) return fail(400, { success: false, errors: { name: ['กรุณากรอกชื่อหน่วยนับ'] } });

		try {
			await db.insert(medianPriceUnits).values({ name });
			return { success: true, message: 'เพิ่มหน่วยนับสำเร็จ' };
		} catch (err) {
			console.error('Create unit error:', err);
			return fail(500, { success: false, errors: { name: ['เกิดข้อผิดพลาด'] } });
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

			// Load lookups for name→id mapping
			const allCategories = await db.select().from(medianPriceCategories);
			const allUnits = await db.select().from(medianPriceUnits);
			const allProvinces = await db.select().from(provinces);

			const catMap = new Map(allCategories.map((c) => [c.name.trim(), c.id]));
			const unitMap = new Map(allUnits.map((u) => [u.name.trim(), u.id]));
			const provMap = new Map(allProvinces.map((p) => [p.name.trim(), p.id]));

			let created = 0;
			let skipped = 0;

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				const categoryName = row['หมวดหมู่']?.trim();
				const itemName = row['ชื่อรายการ']?.trim();
				const priceStr = row['ราคา']?.trim();
				const provinceName = row['จังหวัด']?.trim();
				const unitName = row['หน่วยนับ']?.trim();
				const effectiveDate = row['วันที่มีผล']?.trim();

				if (!categoryName || !itemName || !priceStr || !provinceName || !effectiveDate) {
					skipped++;
					continue;
				}

				const categoryId = catMap.get(categoryName);
				const provinceId = provMap.get(provinceName);
				if (!categoryId || !provinceId) {
					skipped++;
					continue;
				}

				const unitId = unitName ? unitMap.get(unitName) ?? null : null;
				const price = parseFloat(priceStr);
				if (isNaN(price)) { skipped++; continue; }

				await db.insert(medianPrices).values({
					category_id: categoryId,
					item_name: itemName,
					unit_id: unitId,
					price: price.toFixed(2),
					province_id: provinceId,
					effective_date: effectiveDate
				});

				created++;
			}

			const msg = `นำเข้าสำเร็จ ${created} รายการ` + (skipped > 0 ? ` (ข้าม ${skipped} รายการ)` : '');
			return { success: true, message: msg };
		} catch (err) {
			console.error('Import CSV error:', err);
			return fail(500, { success: false, errors: { csv: ['เกิดข้อผิดพลาดในการนำเข้า'] } });
		}
	}
};
