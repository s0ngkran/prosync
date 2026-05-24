<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import BackButton from '$lib/components/BackButton.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import { exportToCsv, downloadCsvTemplate } from '$lib/utils/format';
	import { watchFormResult } from '$lib/stores/toast.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	watchFormResult(() => form);

	let editingId = $state<number | null>(null);
	let editName = $state('');
	let editType = $state('');
	let editProvinceId = $state<number | null>(null);
	let showCreateForm = $state(false);
	let showImportModal = $state(false);
	let currentPage = $state(1);
	const perPage = 10;

	let paginatedAgencies = $derived(
		data.agencies.slice((currentPage - 1) * perPage, currentPage * perPage)
	);
	let totalPages = $derived(Math.ceil(data.agencies.length / perPage));

	const agencyTypes = [
		{ value: 'โรงพยาบาล', label: 'โรงพยาบาล' },
		{ value: 'อบจ.', label: 'อบจ.' },
		{ value: 'เทศบาลนคร', label: 'เทศบาลนคร' },
		{ value: 'เทศบาลเมือง', label: 'เทศบาลเมือง' },
		{ value: 'เทศบาลตำบล', label: 'เทศบาลตำบล' },
		{ value: 'อบต.', label: 'อบต.' }
	];

	function startEdit(agency: any) { editingId = agency.id; editName = agency.name; editType = agency.agency_type ?? ''; editProvinceId = agency.province_id; }
	function cancelEdit() { editingId = null; }

	function handleExportCsv() {
		exportToCsv('agencies', [
			{ key: 'name', label: 'ชื่อหน่วยงาน' },
			{ key: 'agency_type', label: 'ประเภท' },
			{ key: 'province_name', label: 'จังหวัด' }
		], data.agencies);
	}
</script>

<div class="page-container">
	<BackButton href="/admin" label="กลับหน้าจัดการระบบ" />

	<div class="page-header">
		<div>
			<h1 class="page-title">จัดการหน่วยงาน</h1>
			<p class="page-subtitle">
				เพิ่ม แก้ไข ลบ หน่วยงานในระบบ
				<span class="item-count">{data.agencies.length} หน่วยงาน</span>
			</p>
		</div>
		<div class="header-actions">
			<button onclick={() => (showImportModal = true)} class="btn-secondary">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
				นำเข้า CSV
			</button>
			<button onclick={handleExportCsv} class="btn-secondary">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
				ส่งออก CSV
			</button>
			<button onclick={() => (showCreateForm = !showCreateForm)} class="btn-primary">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
				เพิ่มหน่วยงาน
			</button>
		</div>
	</div>

	<!-- Toast notifications handled by global Toast component -->

	<!-- Create Form -->
	{#if showCreateForm}
		<div class="create-card">
			<h2 class="create-title">เพิ่มหน่วยงานใหม่</h2>
			<form method="POST" action="?/create" use:enhance={() => {
				return async ({ update }) => { await update(); if (form?.success) showCreateForm = false; };
			}} class="create-grid">
				<div class="form-field">
					<label class="form-label">ชื่อหน่วยงาน <span class="required">*</span></label>
					<input type="text" name="name" required class="form-input" placeholder="กรอกชื่อหน่วยงาน" />
				</div>
				<div class="form-field">
					<label class="form-label">ประเภท <span class="required">*</span></label>
					<CustomSelect name="agency_type" required options={agencyTypes} placeholder="-- เลือกประเภท --" class="mt-1" />
				</div>
				<div class="form-field">
					<label class="form-label">จังหวัด <span class="required">*</span></label>
					<CustomSelect name="province_id" required options={data.provinces.map(p => ({ value: String(p.id), label: p.name }))} placeholder="-- เลือกจังหวัด --" class="mt-1" />
				</div>
				<div class="form-field create-actions">
					<button type="submit" class="btn-primary full-width">เพิ่มหน่วยงาน</button>
					<button type="button" onclick={() => (showCreateForm = false)} class="btn-ghost full-width">ยกเลิก</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Table -->
	<div class="table-card">
		<div class="table-scroll">
			<table class="data-table">
				<thead>
					<tr>
						<th>ชื่อหน่วยงาน</th>
						<th>ประเภท</th>
						<th>จังหวัด</th>
						<th class="action-col">จัดการ</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedAgencies as agency (agency.id)}
						{#if editingId === agency.id}
							<tr class="editing-row">
								<td colspan="4">
									<form method="POST" action="?/update" use:enhance={() => {
										return async ({ update }) => { await update(); editingId = null; };
									}} class="edit-grid">
										<input type="hidden" name="id" value={agency.id} />
										<input type="text" name="name" bind:value={editName} required class="form-input" />
										<CustomSelect name="agency_type" bind:value={editType} required options={agencyTypes} placeholder="-- ประเภท --" class="mt-1" />
										<CustomSelect name="province_id" value={String(editProvinceId ?? '')} onchange={(v) => { editProvinceId = v ? Number(v) : null; }} required options={data.provinces.map(p => ({ value: String(p.id), label: p.name }))} placeholder="-- จังหวัด --" class="mt-1" />
										<div class="edit-actions">
											<button type="submit" class="btn-sm-primary">บันทึก</button>
											<button type="button" onclick={cancelEdit} class="btn-sm-ghost">ยกเลิก</button>
										</div>
									</form>
								</td>
							</tr>
						{:else}
							<tr>
								<td class="name-cell">{agency.name}</td>
								<td class="type-cell">{agency.agency_type ?? '-'}</td>
								<td>{agency.province_name ?? '-'}</td>
								<td class="action-col">
									<div class="row-actions">
										<button onclick={() => startEdit(agency)} class="action-btn edit-btn">แก้ไข</button>
										<form method="POST" action="?/delete" use:enhance={() => {
											return async ({ update }) => { const { confirmDelete } = await import('$lib/utils/swal'); if (await confirmDelete()) await update(); };
										}} class="inline-form">
											<input type="hidden" name="id" value={agency.id} />
											<button type="submit" class="action-btn delete-btn">ลบ</button>
										</form>
									</div>
								</td>
							</tr>
						{/if}
					{:else}
						<tr><td colspan="4" class="empty-cell">ยังไม่มีหน่วยงานในระบบ</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if totalPages > 1}
			<div class="pagination">
				<span class="page-info">หน้า {currentPage} จาก {totalPages}</span>
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
		{:else}
			<div class="list-footer">ทั้งหมด {data.agencies.length} รายการ</div>
		{/if}
	</div>
</div>

<!-- Import CSV Modal -->
{#if showImportModal}
	<div class="modal-backdrop" onclick={() => (showImportModal = false)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<h2 class="modal-title">นำเข้าหน่วยงานจาก CSV</h2>
			<p style="margin: 0 0 12px; font-size: 0.8125rem; color: oklch(0.5 0.02 180);">อัปโหลดไฟล์ CSV ที่มีข้อมูลหน่วยงาน</p>

			<div style="padding: 14px; border-radius: 10px; border: 1px dashed oklch(0.82 0.015 180); background: oklch(0.98 0.005 180);">
				<p style="margin: 0 0 6px; font-size: 0.75rem; color: oklch(0.5 0.02 180);">คอลัมน์ที่รองรับ:</p>
				<p style="margin: 0; font-size: 0.75rem; font-family: monospace; color: oklch(0.35 0.02 180);">ชื่อหน่วยงาน*, ประเภท*, จังหวัด*</p>
				<p style="margin: 4px 0 0; font-size: 0.6875rem; color: oklch(0.6 0.02 180);">* = จำเป็น | ประเภท: โรงพยาบาล, อบจ., เทศบาลนคร, เทศบาลเมือง, เทศบาลตำบล, อบต. | ชื่อจังหวัดต้องตรงกับที่มีในระบบ</p>
				<button type="button" onclick={() => downloadCsvTemplate('agencies',
					['ชื่อหน่วยงาน', 'ประเภท', 'จังหวัด'],
					[
						['โรงพยาบาลร้อยเอ็ด', 'โรงพยาบาล', 'ร้อยเอ็ด'],
						['เทศบาลเมืองร้อยเอ็ด', 'เทศบาลเมือง', 'ร้อยเอ็ด'],
						['อบจ. ขอนแก่น', 'อบจ.', 'ขอนแก่น'],
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

	.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin: 20px 0 24px; gap: 16px; }
	.page-title { margin: 0 0 4px 0; font-size: clamp(1.375rem, 1.1rem + 0.7vw, 1.625rem); font-weight: 700; color: oklch(0.2 0.02 180); }
	.page-subtitle { margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180); display: flex; align-items: center; gap: 10px; }
	.item-count { padding: 2px 10px; border-radius: 6px; background: oklch(0.54 0.16 150 / 0.08); color: oklch(0.42 0.14 150); font-size: 0.75rem; font-weight: 600; }
	.header-actions { display: flex; gap: 10px; flex-shrink: 0; }

	/* Buttons */
	.btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 10px; border: none; background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: transform 0.15s ease, opacity 0.15s ease; }
	.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
	.btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; border: 1px solid oklch(0.88 0.01 180); background: oklch(0.98 0.005 180); color: oklch(0.35 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; }
	.btn-secondary:hover { background: oklch(0.95 0.005 180); }
	.btn-ghost { padding: 8px 16px; border-radius: 10px; border: none; background: none; color: oklch(0.45 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; }
	.btn-ghost:hover { background: oklch(0.95 0.005 180); }
	.btn-icon { width: 16px; height: 16px; }
	.full-width { width: 100%; justify-content: center; }

	.btn-sm-primary { padding: 6px 14px; border-radius: 8px; border: none; background: oklch(0.54 0.16 150); color: oklch(0.98 0.005 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; }
	.btn-sm-ghost { padding: 6px 14px; border-radius: 8px; border: none; background: none; color: oklch(0.45 0.02 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; }
	.btn-sm-ghost:hover { background: oklch(0.95 0.005 180); }

	/* Create Card */
	.create-card { background: oklch(0.98 0.005 180); border: 1px solid oklch(0.88 0.01 180); border-radius: 14px; padding: 24px; margin-bottom: 20px; animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
	.create-title { margin: 0 0 16px 0; font-size: 1.0625rem; font-weight: 600; color: oklch(0.25 0.02 180); }
	.create-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; align-items: end; }
	.create-actions { display: flex; flex-direction: column; gap: 6px; }

	/* Form */
	.form-field { display: flex; flex-direction: column; gap: 6px; }
	.form-label { font-size: 0.8125rem; font-weight: 500; color: oklch(0.35 0.02 180); }
	.required { color: oklch(0.58 0.2 25); }
	.form-input { padding: 9px 14px; border: 1px solid oklch(0.82 0.015 180); border-radius: 10px; background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif; font-size: 0.875rem; color: oklch(0.25 0.02 180); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
	.form-input:focus { outline: none; border-color: oklch(0.52 0.14 240); box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12); }

	/* Table */
	.table-card { border-radius: 14px; border: 1px solid oklch(0.92 0.005 180); background: oklch(0.995 0.002 180); overflow: hidden; }
	.table-scroll { max-height: calc(100vh - 360px); min-height: 200px; overflow-y: auto; }
	.table-scroll::-webkit-scrollbar { width: 6px; }
	.table-scroll::-webkit-scrollbar-thumb { background: oklch(0.82 0.01 180); border-radius: 3px; }

	.data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	.data-table thead { position: sticky; top: 0; z-index: 1; }
	.data-table th { text-align: left; padding: 12px 20px; font-weight: 500; color: oklch(0.45 0.02 180); background: oklch(0.97 0.005 180); border-bottom: 1px solid oklch(0.9 0.005 180); font-size: 0.8125rem; }
	.data-table td { padding: 12px 20px; color: oklch(0.3 0.02 180); border-bottom: 1px solid oklch(0.95 0.003 180); }
	.data-table tr:last-child td { border-bottom: none; }
	.data-table tr:hover td { background: oklch(0.52 0.14 240 / 0.02); }

	.name-cell { font-weight: 500; color: oklch(0.2 0.02 180); }
	.type-cell { color: oklch(0.45 0.02 180); }
	.action-col { width: 140px; text-align: right; }

	.editing-row td { background: oklch(0.52 0.14 240 / 0.03); padding: 16px 20px; }
	.edit-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap: 10px; align-items: center; }
	.edit-actions { display: flex; gap: 6px; }

	.row-actions { display: flex; gap: 4px; justify-content: flex-end; }
	.action-btn { padding: 4px 12px; border-radius: 8px; border: none; background: none; font-size: 0.8125rem; font-weight: 500; cursor: pointer; }
	.edit-btn { color: oklch(0.52 0.14 240); }
	.edit-btn:hover { background: oklch(0.52 0.14 240 / 0.08); }
	.delete-btn { color: oklch(0.58 0.2 25); }
	.delete-btn:hover { background: oklch(0.58 0.2 25 / 0.08); }
	.inline-form { display: inline; }
	.empty-cell { text-align: center; padding: 48px 20px; color: oklch(0.55 0.02 180); }

	/* Pagination */
	.pagination { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-top: 1px solid oklch(0.92 0.005 180); }
	.page-info { font-size: 0.8125rem; color: oklch(0.5 0.02 180); }
	.page-btns { display: flex; gap: 4px; }
	.page-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); background: oklch(0.98 0.005 180); color: oklch(0.4 0.02 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; }
	.page-btn:hover:not(:disabled) { background: oklch(0.52 0.14 240 / 0.08); border-color: oklch(0.52 0.14 240 / 0.3); }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.page-btn svg { width: 14px; height: 14px; }
	.page-active { background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180); border-color: oklch(0.52 0.14 240); }
	.list-footer { padding: 12px 20px; font-size: 0.8125rem; color: oklch(0.55 0.02 180); text-align: center; border-top: 1px solid oklch(0.92 0.005 180); }

	/* Modal */
	.modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px); animation: fade-in 0.2s ease; }
	.modal-card { width: 100%; max-width: 520px; background: oklch(0.995 0.002 180); border-radius: 18px; padding: 28px; box-shadow: 0 20px 60px oklch(0.15 0.02 180 / 0.2); animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
	.modal-title { margin: 0 0 20px 0; font-size: 1.125rem; font-weight: 600; color: oklch(0.2 0.02 180); }
	.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 16px; border-top: 1px solid oklch(0.92 0.005 180); }

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
	@keyframes slide-down { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }

	@media (max-width: 768px) { .page-header { flex-direction: column; } .create-grid { grid-template-columns: 1fr; } .edit-grid { grid-template-columns: 1fr; } }
</style>
