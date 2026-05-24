<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import { exportToCsv, downloadCsvTemplate } from '$lib/utils/format';
	import { watchFormResult } from '$lib/stores/toast.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	watchFormResult(() => form);

	let showCreateForm = $state(false);
	let showImportModal = $state(false);
	let editingId = $state<number | null>(null);
	let editingName = $state('');
	let deletingId = $state<number | null>(null);
	let currentPage = $state(1);
	const perPage = 10;

	let paginatedProvinces = $derived(
		data.provinces.slice((currentPage - 1) * perPage, currentPage * perPage)
	);
	let totalPages = $derived(Math.ceil(data.provinces.length / perPage));

	function startEdit(id: number, name: string) { editingId = id; editingName = name; }
	function cancelEdit() { editingId = null; editingName = ''; }
	function confirmDelete(id: number) { deletingId = id; }
	function cancelDelete() { deletingId = null; }

	function handleExportCsv() {
		exportToCsv('provinces', [
			{ key: 'id', label: 'รหัส' },
			{ key: 'name', label: 'ชื่อจังหวัด' }
		], data.provinces);
	}
</script>

<div class="page-container">
	<BackButton href="/admin" label="กลับหน้าจัดการระบบ" />

	<div class="page-header">
		<div>
			<h1 class="page-title">จัดการจังหวัด</h1>
			<p class="page-subtitle">
				เพิ่ม แก้ไข ลบ ข้อมูลจังหวัดในระบบ
				<span class="item-count">{data.provinces.length} จังหวัด</span>
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
				เพิ่มจังหวัด
			</button>
		</div>
	</div>

	<!-- Create Form -->
	{#if showCreateForm}
		<div class="create-card">
			<form method="POST" action="?/create" use:enhance={() => {
				return async ({ update }) => { await update(); if (form?.success) showCreateForm = false; };
			}} class="create-row">
				<div class="form-field create-field">
					<label for="create-name" class="form-label">ชื่อจังหวัด <span class="required">*</span></label>
					<input id="create-name" type="text" name="name" placeholder="เช่น กรุงเทพมหานคร" required class="form-input" />
					{#if form && !form.success && form.errors?.name}
						<p class="form-error">{form.errors.name[0]}</p>
					{/if}
				</div>
				<div class="create-actions">
					<button type="submit" class="btn-primary">บันทึก</button>
					<button type="button" onclick={() => (showCreateForm = false)} class="btn-ghost">ยกเลิก</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Table -->
	<div class="table-card">
		<table class="data-table">
			<thead>
				<tr>
					<th class="id-col">รหัส</th>
					<th>ชื่อจังหวัด</th>
					<th class="action-col">จัดการ</th>
				</tr>
			</thead>
			<tbody>
				{#each paginatedProvinces as province (province.id)}
					<tr>
						{#if editingId === province.id}
							<td class="id-col id-cell">{province.id}</td>
							<td>
								<form method="POST" action="?/update" use:enhance={() => {
									return async ({ update }) => { await update(); cancelEdit(); };
								}} class="edit-row">
									<input type="hidden" name="id" value={province.id} />
									<input type="text" name="name" bind:value={editingName} required class="form-input edit-input" />
									<button type="submit" class="btn-sm-primary">บันทึก</button>
									<button type="button" onclick={cancelEdit} class="btn-sm-ghost">ยกเลิก</button>
								</form>
							</td>
							<td></td>
						{:else if deletingId === province.id}
							<td class="id-col id-cell">{province.id}</td>
							<td class="delete-confirm">ยืนยันลบ "{province.name}" ?</td>
							<td class="action-col">
								<form method="POST" action="?/delete" use:enhance={() => {
									return async ({ update }) => { await update(); cancelDelete(); };
								}} class="action-row">
									<input type="hidden" name="id" value={province.id} />
									<button type="submit" class="btn-sm-danger">ลบ</button>
									<button type="button" onclick={cancelDelete} class="btn-sm-ghost">ยกเลิก</button>
								</form>
							</td>
						{:else}
							<td class="id-col id-cell">{province.id}</td>
							<td class="name-cell">{province.name}</td>
							<td class="action-col">
								<div class="row-actions">
									<button onclick={() => startEdit(province.id, province.name)} class="action-btn edit-btn">แก้ไข</button>
									<button onclick={() => confirmDelete(province.id)} class="action-btn delete-btn">ลบ</button>
								</div>
							</td>
						{/if}
					</tr>
				{:else}
					<tr><td colspan="3" class="empty-cell">ยังไม่มีข้อมูลจังหวัด</td></tr>
				{/each}
			</tbody>
		</table>

		<!-- Pagination -->
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
			<div class="list-footer">ทั้งหมด {data.provinces.length} รายการ</div>
		{/if}
	</div>
</div>

<!-- Import CSV Modal -->
{#if showImportModal}
	<div class="modal-backdrop" onclick={() => (showImportModal = false)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<h2 class="modal-title">นำเข้าจังหวัดจาก CSV</h2>

			<div style="padding: 14px; border-radius: 10px; border: 1px dashed oklch(0.82 0.015 180); background: oklch(0.98 0.005 180);">
				<p style="margin: 0 0 6px; font-size: 0.75rem; color: oklch(0.5 0.02 180);">คอลัมน์ที่รองรับ:</p>
				<p style="margin: 0; font-size: 0.75rem; font-family: monospace; color: oklch(0.35 0.02 180);">ชื่อจังหวัด*</p>
				<p style="margin: 4px 0 0; font-size: 0.6875rem; color: oklch(0.6 0.02 180);">* = จำเป็น | จังหวัดที่ชื่อซ้ำจะถูกข้าม</p>
				<button type="button" onclick={() => downloadCsvTemplate('provinces',
					['ชื่อจังหวัด'],
					[
						['กรุงเทพมหานคร'],
						['เชียงใหม่'],
						['ขอนแก่น'],
						['นครราชสีมา'],
						['สงขลา'],
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
	.item-count { padding: 2px 10px; border-radius: 6px; background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.12 240); font-size: 0.75rem; font-weight: 600; }
	.header-actions { display: flex; gap: 10px; flex-shrink: 0; }

	/* Buttons */
	.btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 10px; border: none; background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: transform 0.15s ease, opacity 0.15s ease; }
	.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
	.btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; border: 1px solid oklch(0.88 0.01 180); background: oklch(0.98 0.005 180); color: oklch(0.35 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; }
	.btn-secondary:hover { background: oklch(0.95 0.005 180); }
	.btn-ghost { padding: 8px 16px; border-radius: 10px; border: none; background: none; color: oklch(0.45 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; }
	.btn-ghost:hover { background: oklch(0.95 0.005 180); }
	.btn-icon { width: 16px; height: 16px; }

	.btn-sm-primary { padding: 5px 14px; border-radius: 8px; border: none; background: oklch(0.54 0.16 150); color: oklch(0.98 0.005 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; }
	.btn-sm-ghost { padding: 5px 14px; border-radius: 8px; border: none; background: none; color: oklch(0.45 0.02 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; }
	.btn-sm-ghost:hover { background: oklch(0.95 0.005 180); }
	.btn-sm-danger { padding: 5px 14px; border-radius: 8px; border: none; background: oklch(0.58 0.2 25); color: oklch(0.98 0.005 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; }

	/* Create Card */
	.create-card { background: oklch(0.98 0.005 180); border: 1px solid oklch(0.88 0.01 180); border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
	.create-row { display: flex; align-items: flex-end; gap: 14px; }
	.create-field { flex: 1; }
	.create-actions { display: flex; gap: 8px; }

	/* Form */
	.form-field { display: flex; flex-direction: column; gap: 6px; }
	.form-label { font-size: 0.8125rem; font-weight: 500; color: oklch(0.35 0.02 180); }
	.required { color: oklch(0.58 0.2 25); }
	.form-input { padding: 9px 14px; border: 1px solid oklch(0.82 0.015 180); border-radius: 10px; background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif; font-size: 0.9375rem; color: oklch(0.25 0.02 180); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
	.form-input:focus { outline: none; border-color: oklch(0.52 0.14 240); box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12); }
	.form-error { font-size: 0.8125rem; color: oklch(0.58 0.2 25); }

	/* Table */
	.table-card { border-radius: 14px; border: 1px solid oklch(0.92 0.005 180); background: oklch(0.995 0.002 180); overflow: hidden; }

	.data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	.data-table thead { position: sticky; top: 0; z-index: 1; }
	.data-table th { text-align: left; padding: 12px 20px; font-weight: 500; color: oklch(0.45 0.02 180); background: oklch(0.97 0.005 180); border-bottom: 1px solid oklch(0.9 0.005 180); font-size: 0.8125rem; }
	.data-table td { padding: 14px 20px; color: oklch(0.3 0.02 180); border-bottom: 1px solid oklch(0.95 0.003 180); }
	.data-table tr:last-child td { border-bottom: none; }
	.data-table tr:hover td { background: oklch(0.52 0.14 240 / 0.02); }

	.id-col { width: 80px; }
	.id-cell { color: oklch(0.55 0.02 180); font-variant-numeric: tabular-nums; }
	.name-cell { font-weight: 500; color: oklch(0.2 0.02 180); }
	.action-col { width: 160px; text-align: right; }
	.delete-confirm { color: oklch(0.58 0.2 25); font-weight: 500; }

	.edit-row { display: flex; align-items: center; gap: 10px; }
	.edit-input { flex: 1; }
	.action-row { display: flex; gap: 6px; justify-content: flex-end; }

	.row-actions { display: flex; gap: 4px; justify-content: flex-end; }
	.action-btn { padding: 4px 12px; border-radius: 8px; border: none; background: none; font-size: 0.8125rem; font-weight: 500; cursor: pointer; }
	.edit-btn { color: oklch(0.52 0.14 240); }
	.edit-btn:hover { background: oklch(0.52 0.14 240 / 0.08); }
	.delete-btn { color: oklch(0.58 0.2 25); }
	.delete-btn:hover { background: oklch(0.58 0.2 25 / 0.08); }

	.empty-cell { text-align: center; padding: 48px 20px; color: oklch(0.55 0.02 180); }

	/* Pagination */
	.pagination { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-top: 1px solid oklch(0.92 0.005 180); }
	.page-info { font-size: 0.8125rem; color: oklch(0.5 0.02 180); }
	.page-btns { display: flex; gap: 4px; }
	.page-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); background: oklch(0.98 0.005 180); color: oklch(0.4 0.02 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s ease; }
	.page-btn:hover:not(:disabled) { background: oklch(0.52 0.14 240 / 0.08); border-color: oklch(0.52 0.14 240 / 0.3); }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.page-btn svg { width: 14px; height: 14px; }
	.page-active { background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180); border-color: oklch(0.52 0.14 240); }
	.page-active:hover { background: oklch(0.52 0.14 240); }

	.list-footer { padding: 12px 20px; font-size: 0.8125rem; color: oklch(0.55 0.02 180); text-align: center; border-top: 1px solid oklch(0.92 0.005 180); }

	/* Modal */
	.modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px); animation: fade-in 0.2s ease; }
	.modal-card { width: 100%; max-width: 520px; background: oklch(0.995 0.002 180); border-radius: 18px; padding: 28px; box-shadow: 0 20px 60px oklch(0.15 0.02 180 / 0.2); animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
	.modal-title { margin: 0 0 20px 0; font-size: 1.125rem; font-weight: 600; color: oklch(0.2 0.02 180); }
	.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 16px; border-top: 1px solid oklch(0.92 0.005 180); }

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
	@keyframes slide-down { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }

	@media (max-width: 640px) { .page-header { flex-direction: column; } .create-row { flex-direction: column; align-items: stretch; } }
</style>
