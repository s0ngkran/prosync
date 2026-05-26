<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import BackButton from '$lib/components/BackButton.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import { formatBaht, formatThaiDate, exportToCsv, downloadCsvTemplate } from '$lib/utils/format';
	import CustomDatePicker from '$lib/components/CustomDatePicker.svelte';
	import { watchFormResult } from '$lib/stores/toast.svelte';
	import { swalConfirmDelete } from '$lib/utils/swal';

	let { data, form: formResult } = $props();

	watchFormResult(() => formResult);
	let showCreateModal = $state(false);
	let showImportModal = $state(false);
	let showManageModal = $state<'category' | 'unit' | null>(null);
	let editingPrice = $state<any>(null);
	let searchQuery = $state('');
	let filterCategoryId = $state('');
	let currentPage = $state(1);
	const perPage = 10;

	function onProvinceChange(val: string) {
		if (val) goto(`/admin/median-prices?province_id=${val}`);
		else goto('/admin/median-prices');
	}

	let filteredPrices = $derived.by(() => {
		let result = data.prices as any[];
		if (filterCategoryId) {
			result = result.filter((p: any) => String(p.category_id) === filterCategoryId);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			result = result.filter((p: any) =>
				p.category_name?.toLowerCase().includes(q) ||
				p.item_name.toLowerCase().includes(q)
			);
		}
		return result;
	});

	let paginatedPrices = $derived(
		filteredPrices.slice((currentPage - 1) * perPage, currentPage * perPage)
	);
	let totalPages = $derived(Math.ceil(filteredPrices.length / perPage));

	function handleExportCsv() {
		exportToCsv('median-prices', [
			{ key: 'category_name', label: 'หมวดหมู่' },
			{ key: 'item_name', label: 'ชื่อรายการ' },
			{ key: 'unit_name', label: 'หน่วยนับ' },
			{ key: 'price', label: 'ราคากลาง (บาท)' },
			{ key: 'effective_date', label: 'วันที่มีผล' }
		], data.prices);
	}
</script>

<div class="page-container">
	<BackButton href="/admin" label="กลับหน้าจัดการระบบ" />

	<div class="page-header">
		<div>
			<h1 class="page-title">ราคากลาง</h1>
			<p class="page-subtitle">จัดการราคากลางแยกตามจังหวัด</p>
		</div>
		{#if data.selectedProvinceId}
			<div class="header-actions">
				<button onclick={() => (showManageModal = 'category')} class="btn-secondary">จัดการหมวดหมู่</button>
				<button onclick={() => (showManageModal = 'unit')} class="btn-secondary">จัดการหน่วยนับ</button>
				<button onclick={() => (showImportModal = true)} class="btn-secondary">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
					นำเข้า CSV
				</button>
				<button onclick={handleExportCsv} class="btn-secondary">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
					ส่งออก CSV
				</button>
				<button onclick={() => (showCreateModal = true)} class="btn-primary">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
					เพิ่มราคากลาง
				</button>
			</div>
		{/if}
	</div>

	<!-- Province Selector -->
	<div class="province-bar">
		<div class="province-field">
			<svg class="province-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
			<span class="province-label">จังหวัด</span>
			<CustomSelect
				options={data.provinces.map((p: any) => ({ value: String(p.id), label: p.name }))}
				value={data.selectedProvinceId ? String(data.selectedProvinceId) : ''}
				onchange={onProvinceChange}
				placeholder="-- เลือกจังหวัด --"
				class="province-select"
			/>
		</div>
		{#if data.selectedProvinceName}
			<span class="province-count">{data.prices.length} รายการ</span>
		{/if}
	</div>

	{#if data.selectedProvinceId}
		<!-- Filter -->
		<div class="filter-bar">
			<div class="search-wrap">
				<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
				<input type="text" placeholder="ค้นหาหมวดหมู่ หรือชื่อรายการ..." bind:value={searchQuery} class="search-input" />
				{#if searchQuery}
					<button class="search-clear" onclick={() => (searchQuery = '')}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				{/if}
			</div>
			<div class="filter-chips">
				<button class="chip" class:chip-active={!filterCategoryId} onclick={() => { filterCategoryId = ''; currentPage = 1; }}>ทั้งหมด</button>
				{#each data.categories as cat}
					<button class="chip" class:chip-active={filterCategoryId === String(cat.id)} onclick={() => { filterCategoryId = String(cat.id); currentPage = 1; }}>{cat.name}</button>
				{/each}
			</div>
		</div>

		<!-- Table -->
		<div class="table-scroll">
			<table class="data-table" style="table-layout: fixed;">
				<colgroup>
					<col style="width: 15%;" />
					<col style="width: 25%;" />
					<col style="width: 12%;" />
					<col style="width: 15%;" />
					<col style="width: 15%;" />
					<col style="width: 18%;" />
				</colgroup>
				<thead>
					<tr>
						<th>หมวดหมู่</th>
						<th>ชื่อรายการ</th>
						<th>หน่วยนับ</th>
						<th class="num">ราคากลาง</th>
						<th>วันที่มีผล</th>
						<th class="action-col">จัดการ</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedPrices as price}
						<tr>
							<td class="category-cell truncate">{price.category_name}</td>
							<td class="item-cell truncate">{price.item_name}</td>
							<td class="truncate">{price.unit_name || '-'}</td>
							<td class="num price-cell">{formatBaht(price.price)}</td>
							<td class="date-cell">{formatThaiDate(price.effective_date)}</td>
							<td class="action-col">
								<div class="row-actions">
									<button onclick={() => (editingPrice = price)} class="action-btn edit-btn">แก้ไข</button>
									<form method="POST" action="?/delete&province_id={data.selectedProvinceId}" use:enhance class="inline-form">
										<input type="hidden" name="id" value={price.id} />
										<button type="submit" onclick={(e) => swalConfirmDelete(e)} class="action-btn delete-btn">ลบ</button>
									</form>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="empty-cell">
								{#if searchQuery || filterCategoryId}
									ไม่พบข้อมูลที่ตรงกับเงื่อนไข
								{:else}
									ยังไม่มีข้อมูลราคากลางในจังหวัด{data.selectedProvinceName}
								{/if}
							</td>
						</tr>
					{/each}
					{#each Array(Math.max(0, perPage - paginatedPrices.length)) as _}
						<tr>
							<td>&nbsp;</td>
							<td></td>
							<td></td>
							<td></td>
							<td></td>
							<td></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if totalPages > 1}
			<div class="pagination">
				<span class="page-info">หน้า {currentPage} จาก {totalPages} (แสดง {filteredPrices.length} รายการ)</span>
				<div class="page-btns">
					<button disabled={currentPage <= 1} onclick={() => (currentPage = Math.max(1, currentPage - 1))} class="page-btn">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
					</button>
					{#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
						<button class="page-btn" class:page-active={p === currentPage} onclick={() => (currentPage = p)}>{p}</button>
					{/each}
					<button disabled={currentPage >= totalPages} onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))} class="page-btn">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
					</button>
				</div>
			</div>
		{:else if filteredPrices.length > 0}
			<div class="list-footer">ทั้งหมด {filteredPrices.length} รายการ</div>
		{/if}
	{:else}
		<div class="empty-state">
			<div class="empty-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			</div>
			<h3 class="empty-title">เลือกจังหวัดเพื่อจัดการราคากลาง</h3>
			<p class="empty-desc">กรุณาเลือกจังหวัดจากรายการด้านบนเพื่อดูและจัดการข้อมูลราคากลาง</p>
		</div>
	{/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div class="modal-backdrop" onclick={() => (showCreateModal = false)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<h2 class="modal-title">เพิ่มราคากลาง</h2>
			<form method="POST" action="?/create&province_id={data.selectedProvinceId}" use:enhance={() => {
				return async ({ update }) => { showCreateModal = false; await update(); };
			}}>
				<div class="modal-body">
					<div class="form-field">
						<label class="form-label">หมวดหมู่ <span class="required">*</span></label>
						<CustomSelect name="category_id" required options={data.categories.map((c: any) => ({ value: String(c.id), label: c.name }))} placeholder="-- เลือกหมวดหมู่ --" class="mt-1" />
					</div>
					<div class="form-field">
						<label class="form-label">ชื่อรายการ <span class="required">*</span></label>
						<input name="item_name" required class="form-input" />
					</div>
					<div class="form-row">
						<div class="form-field">
							<label class="form-label">หน่วยนับ</label>
							<CustomSelect name="unit_id" options={data.units.map((u: any) => ({ value: String(u.id), label: u.name }))} placeholder="-- ไม่ระบุ --" class="mt-1" />
						</div>
						<div class="form-field">
							<label class="form-label">ราคากลาง (บาท) <span class="required">*</span></label>
							<input name="price" type="number" step="0.01" required class="form-input" />
						</div>
					</div>
					<input type="hidden" name="province_id" value={data.selectedProvinceId} />
					<div class="form-field">
						<label class="form-label">วันที่มีผล <span class="required">*</span></label>
						<CustomDatePicker name="effective_date" required />
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" onclick={() => (showCreateModal = false)} class="btn-ghost">ยกเลิก</button>
					<button type="submit" class="btn-primary">บันทึก</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Modal -->
{#if editingPrice}
	<div class="modal-backdrop" onclick={() => (editingPrice = null)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<h2 class="modal-title">แก้ไขราคากลาง</h2>
			<form method="POST" action="?/update&province_id={data.selectedProvinceId}" use:enhance={() => {
				return async ({ update }) => { editingPrice = null; await update(); };
			}}>
				<input type="hidden" name="id" value={editingPrice.id} />
				<div class="modal-body">
					<div class="form-field">
						<label class="form-label">หมวดหมู่ <span class="required">*</span></label>
						<CustomSelect name="category_id" required options={data.categories.map((c: any) => ({ value: String(c.id), label: c.name }))} value={String(editingPrice.category_id)} placeholder="-- เลือกหมวดหมู่ --" class="mt-1" />
					</div>
					<div class="form-field">
						<label class="form-label">ชื่อรายการ <span class="required">*</span></label>
						<input name="item_name" value={editingPrice.item_name} required class="form-input" />
					</div>
					<div class="form-row">
						<div class="form-field">
							<label class="form-label">หน่วยนับ</label>
							<CustomSelect name="unit_id" options={data.units.map((u: any) => ({ value: String(u.id), label: u.name }))} value={editingPrice.unit_id ? String(editingPrice.unit_id) : ''} placeholder="-- ไม่ระบุ --" class="mt-1" />
						</div>
						<div class="form-field">
							<label class="form-label">ราคากลาง (บาท) <span class="required">*</span></label>
							<input name="price" type="number" step="0.01" value={editingPrice.price} required class="form-input" />
						</div>
					</div>
					<div class="form-field">
						<label class="form-label">วันที่มีผล <span class="required">*</span></label>
						<CustomDatePicker name="effective_date" value={editingPrice.effective_date} required />
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" onclick={() => (editingPrice = null)} class="btn-ghost">ยกเลิก</button>
					<button type="submit" class="btn-primary">บันทึก</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Manage Category / Unit Modal -->
{#if showManageModal}
	<div class="modal-backdrop" onclick={() => (showManageModal = null)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()} style="max-width: 420px;">
			<h2 class="modal-title">{showManageModal === 'category' ? 'จัดการหมวดหมู่' : 'จัดการหน่วยนับ'}</h2>

			<!-- Existing list -->
			<div class="manage-list">
				{#each (showManageModal === 'category' ? data.categories : data.units) as item}
					<div class="manage-item">
						<span>{item.name}</span>
					</div>
				{:else}
					<p class="manage-empty">ยังไม่มีข้อมูล</p>
				{/each}
			</div>

			<!-- Quick add form -->
			<form method="POST" action={showManageModal === 'category' ? '?/createCategory' : '?/createUnit'} use:enhance={() => {
				return async ({ update }) => { await update(); };
			}} class="manage-add">
				<input name="name" required placeholder={showManageModal === 'category' ? 'ชื่อหมวดหมู่ใหม่' : 'ชื่อหน่วยนับใหม่'} class="form-input" style="flex:1;" />
				<button type="submit" class="btn-primary" style="flex-shrink:0;">เพิ่ม</button>
			</form>

			<div class="modal-footer" style="border-top:none; margin-top:8px;">
				<button type="button" onclick={() => (showManageModal = null)} class="btn-ghost">ปิด</button>
			</div>
		</div>
	</div>
{/if}

<!-- Import CSV Modal -->
{#if showImportModal}
	<div class="modal-backdrop" onclick={() => (showImportModal = false)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<h2 class="modal-title">นำเข้าราคากลางจาก CSV</h2>
			<p style="margin: 0 0 12px; font-size: 0.8125rem; color: oklch(0.5 0.02 180);">อัปโหลดไฟล์ CSV ที่มีข้อมูลราคากลาง</p>

			<div style="padding: 14px; border-radius: 10px; border: 1px dashed oklch(0.82 0.015 180); background: oklch(0.98 0.005 180);">
				<p style="margin: 0 0 6px; font-size: 0.75rem; color: oklch(0.5 0.02 180);">คอลัมน์ที่รองรับ:</p>
				<p style="margin: 0; font-size: 0.75rem; font-family: monospace; color: oklch(0.35 0.02 180);">หมวดหมู่*, ชื่อรายการ*, หน่วยนับ, ราคา*, จังหวัด*, วันที่มีผล*</p>
				<p style="margin: 4px 0 0; font-size: 0.6875rem; color: oklch(0.6 0.02 180);">* = จำเป็น | ชื่อหมวดหมู่/หน่วยนับ/จังหวัดต้องตรงกับที่มีในระบบ | วันที่ใช้รูปแบบ YYYY-MM-DD</p>
				<button type="button" onclick={() => downloadCsvTemplate('median-prices',
					['หมวดหมู่', 'ชื่อรายการ', 'หน่วยนับ', 'ราคา', 'จังหวัด', 'วันที่มีผล'],
					[
						['เวชภัณฑ์', 'ยาสามัญประจำโรงพยาบาล', 'รายการ', '150000.00', 'ร้อยเอ็ด', '2026-01-01'],
						['ครุภัณฑ์การแพทย์', 'เครื่อง X-Ray ดิจิตอล', 'เครื่อง', '3500000.00', 'ร้อยเอ็ด', '2026-01-01'],
						['วัสดุสำนักงาน', 'กระดาษ A4', 'ลัง', '850.00', 'ร้อยเอ็ด', '2026-01-01'],
					]
				)} style="margin-top: 8px; font-size: 0.75rem; color: oklch(0.42 0.12 240); background: none; border: none; cursor: pointer; text-decoration: underline;">
					ดาวน์โหลด Template CSV
				</button>
			</div>

			<form method="POST" action="?/importCsv" enctype="multipart/form-data" use:enhance={() => {
				return async ({ update }) => { showImportModal = false; await update(); };
			}}>
				<div style="margin-top: 16px;">
					<input name="csv_file" type="file" accept=".csv" required style="font-size: 0.875rem;" />
				</div>
				<div class="modal-footer">
					<button type="button" onclick={() => (showImportModal = false)} class="btn-ghost">ยกเลิก</button>
					<button type="submit" class="btn-primary">นำเข้า</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.page-container { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1); }

	.page-header {
		display: flex; justify-content: space-between; align-items: flex-start;
		margin: 20px 0 24px; gap: 16px;
	}
	.page-title { margin: 0 0 4px 0; font-size: clamp(1.375rem, 1.1rem + 0.7vw, 1.625rem); font-weight: 700; color: oklch(0.2 0.02 180); }
	.page-subtitle { margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180); }
	.header-actions { display: flex; gap: 10px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

	/* Buttons */
	.btn-primary {
		display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 10px; border: none;
		background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180); font-size: 0.875rem; font-weight: 500; cursor: pointer;
		transition: transform 0.15s ease, opacity 0.15s ease;
	}
	.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
	.btn-secondary {
		display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px;
		border: 1px solid oklch(0.88 0.01 180); background: oklch(0.98 0.005 180); color: oklch(0.35 0.02 180);
		font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: background 0.15s ease;
	}
	.btn-secondary:hover { background: oklch(0.95 0.005 180); }
	.btn-ghost { padding: 8px 16px; border-radius: 10px; border: none; background: none; color: oklch(0.45 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; }
	.btn-ghost:hover { background: oklch(0.95 0.005 180); }
	.btn-icon { width: 16px; height: 16px; }

	/* Province Bar */
	.province-bar {
		display: flex; align-items: center; justify-content: space-between;
		padding: 16px 20px; margin-bottom: 20px; border-radius: 14px;
		background: oklch(0.98 0.005 180); border: 1px solid oklch(0.9 0.005 180);
	}
	.province-field { display: flex; align-items: center; gap: 10px; }
	.province-icon { width: 20px; height: 20px; color: oklch(0.52 0.14 240); }
	.province-label { font-size: 0.8125rem; font-weight: 500; color: oklch(0.4 0.02 180); }
	.province-count { padding: 3px 12px; border-radius: 6px; background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.12 240); font-size: 0.8125rem; font-weight: 600; }

	/* Filter */
	.filter-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
	.search-wrap { position: relative; min-width: 240px; flex: 1; max-width: 380px; }
	.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: oklch(0.55 0.02 180); pointer-events: none; }
	.search-input {
		width: 100%; padding: 9px 36px 9px 42px; border: 1px solid oklch(0.82 0.015 180); border-radius: 10px;
		background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif;
		font-size: 0.875rem; color: oklch(0.25 0.02 180); transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.search-input:focus { outline: none; border-color: oklch(0.52 0.14 240); box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12); }
	.search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 6px; border: none; background: none; color: oklch(0.55 0.02 180); cursor: pointer; display: flex; align-items: center; justify-content: center; }
	.search-clear svg { width: 14px; height: 14px; }
	.search-clear:hover { background: oklch(0.92 0.005 180); }

	.filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
	.chip {
		padding: 6px 14px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180);
		background: oklch(0.98 0.005 180); color: oklch(0.45 0.02 180);
		font-size: 0.8125rem; font-weight: 500; cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}
	.chip:hover { background: oklch(0.95 0.005 180); }
	.chip-active { background: oklch(0.52 0.14 240 / 0.08); border-color: oklch(0.52 0.14 240 / 0.3); color: oklch(0.42 0.12 240); }

	/* Table */
	.table-scroll {
		max-height: calc(100vh - 380px); min-height: 200px; overflow-y: auto; border-radius: 14px;
		border: 1px solid oklch(0.92 0.005 180); background: oklch(0.995 0.002 180);
	}
	.table-scroll::-webkit-scrollbar { width: 6px; }
	.table-scroll::-webkit-scrollbar-track { background: transparent; }
	.table-scroll::-webkit-scrollbar-thumb { background: oklch(0.82 0.01 180); border-radius: 3px; }

	.data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	.data-table thead { position: sticky; top: 0; z-index: 1; }
	.data-table th { text-align: left; padding: 12px 16px; font-weight: 500; color: oklch(0.45 0.02 180); background: oklch(0.97 0.005 180); border-bottom: 1px solid oklch(0.9 0.005 180); font-size: 0.8125rem; }
	.data-table td { padding: 12px 16px; color: oklch(0.3 0.02 180); border-bottom: 1px solid oklch(0.95 0.003 180); }
	.data-table tr:hover td { background: oklch(0.52 0.14 240 / 0.02); }
	.data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
	.item-cell { font-weight: 500; }
	.price-cell { font-weight: 600; color: oklch(0.52 0.14 240); }
	.date-cell { color: oklch(0.5 0.02 180); }
	.category-cell { color: oklch(0.4 0.02 180); }
	.action-col { width: 120px; text-align: right; }
	.row-actions { display: flex; gap: 4px; justify-content: flex-end; }
	.action-btn { padding: 4px 10px; border-radius: 6px; border: none; background: none; font-size: 0.8125rem; font-weight: 500; cursor: pointer; }
	.edit-btn { color: oklch(0.52 0.14 240); }
	.edit-btn:hover { background: oklch(0.52 0.14 240 / 0.08); }
	.delete-btn { color: oklch(0.58 0.2 25); }
	.delete-btn:hover { background: oklch(0.58 0.2 25 / 0.08); }
	.inline-form { display: inline; }
	.empty-cell { text-align: center; padding: 40px 16px; color: oklch(0.55 0.02 180); }
	.list-footer { padding: 12px 0; font-size: 0.8125rem; color: oklch(0.55 0.02 180); text-align: center; }

	/* Empty State */
	.empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 24px; text-align: center; }
	.empty-icon { width: 72px; height: 72px; border-radius: 50%; margin-bottom: 20px; background: oklch(0.62 0.18 60 / 0.08); display: flex; align-items: center; justify-content: center; }
	.empty-icon svg { width: 36px; height: 36px; color: oklch(0.62 0.18 60); }
	.empty-title { margin: 0 0 8px 0; font-size: 1.125rem; font-weight: 600; color: oklch(0.25 0.02 180); }
	.empty-desc { margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180); max-width: 360px; line-height: 1.5; }

	/* Modal */
	.modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px); animation: fade-in 0.2s ease; }
	.modal-card { width: 100%; max-width: 520px; background: oklch(0.995 0.002 180); border-radius: 18px; padding: 28px; box-shadow: 0 20px 60px oklch(0.15 0.02 180 / 0.2); animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
	.modal-title { margin: 0 0 20px 0; font-size: 1.125rem; font-weight: 600; color: oklch(0.2 0.02 180); }
	.modal-body { display: flex; flex-direction: column; gap: 16px; }
	.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 16px; border-top: 1px solid oklch(0.92 0.005 180); }
	.form-field { display: flex; flex-direction: column; gap: 6px; }
	.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.form-label { font-size: 0.8125rem; font-weight: 500; color: oklch(0.35 0.02 180); }
	.required { color: oklch(0.58 0.2 25); }
	.form-input {
		padding: 10px 14px; border: 1px solid oklch(0.82 0.015 180); border-radius: 10px;
		background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif;
		font-size: 0.9375rem; color: oklch(0.25 0.02 180); transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.form-input:focus { outline: none; border-color: oklch(0.52 0.14 240); box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12); }

	/* Manage list */
	.manage-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; max-height: 240px; overflow-y: auto; }
	.manage-item { padding: 10px 14px; border-radius: 8px; background: oklch(0.97 0.005 180); font-size: 0.875rem; color: oklch(0.3 0.02 180); }
	.manage-empty { padding: 20px; text-align: center; font-size: 0.8125rem; color: oklch(0.55 0.02 180); }
	.manage-add { display: flex; gap: 8px; }

	/* Pagination */
	.pagination { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-top: 1px solid oklch(0.92 0.005 180); }
	.page-info { font-size: 0.8125rem; color: oklch(0.5 0.02 180); }
	.page-btns { display: flex; gap: 4px; }
	.page-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); background: oklch(0.98 0.005 180); color: oklch(0.4 0.02 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; }
	.page-btn:hover:not(:disabled) { background: oklch(0.52 0.14 240 / 0.08); border-color: oklch(0.52 0.14 240 / 0.3); }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.page-btn svg { width: 14px; height: 14px; }
	.page-active { background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180); border-color: oklch(0.52 0.14 240); }

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

	@media (max-width: 768px) {
		.page-header { flex-direction: column; }
		.province-bar { flex-direction: column; align-items: flex-start; gap: 12px; }
		.filter-bar { flex-direction: column; align-items: stretch; }
		.search-wrap { max-width: none; }
		.form-row { grid-template-columns: 1fr; }
	}
</style>
