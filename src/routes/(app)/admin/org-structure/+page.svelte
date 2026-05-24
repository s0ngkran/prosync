<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import { downloadCsvTemplate, exportToCsv } from '$lib/utils/format';
	import { watchFormResult } from '$lib/stores/toast.svelte';
	import { swalConfirmDelete } from '$lib/utils/swal';

	let { data, form: formResult } = $props();

	watchFormResult(() => formResult);
	let showCreateModal = $state(false);
	let showImportModal = $state(false);
	let createParentId = $state<number | null>(null);

	function handleExportCsv() {
		exportToCsv('org-structure', [
			{ key: 'id', label: 'รหัส' },
			{ key: 'name', label: 'ชื่อแผนก' },
			{ key: 'agency_id', label: 'รหัสหน่วยงาน' },
			{ key: 'parent_id', label: 'รหัสแผนกแม่' },
			{ key: 'head_name', label: 'หัวหน้า' }
		], data.units);
	}
	let editingUnit = $state<any>(null);
	let searchQuery = $state('');
	let collapsed = $state(new Set<number>());
	let canManage = $derived((data as any).canManage ?? false);

	function buildTree(units: any[], parentId: number | null = null): any[] {
		return units
			.filter((u) => u.parent_id === parentId)
			.map((u) => ({ ...u, children: buildTree(units, u.id) }));
	}

	function countDescendants(node: any): number {
		let count = node.children?.length ?? 0;
		for (const child of node.children ?? []) {
			count += countDescendants(child);
		}
		return count;
	}

	let tree = $derived(buildTree(data.units));

	// Filter matching
	function matchesSearch(node: any): boolean {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.trim().toLowerCase();
		if (node.name.toLowerCase().includes(q)) return true;
		if (node.head_name?.toLowerCase().includes(q)) return true;
		return (node.children ?? []).some((c: any) => matchesSearch(c));
	}

	function toggleCollapse(id: number) {
		const next = new Set(collapsed);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsed = next;
	}
</script>

{#snippet unitNode(node: any, depth: number)}
	{#if matchesSearch(node)}
		<div class="tree-node" style="--depth: {depth};">
			<div class="node-row">
				<!-- Collapse toggle -->
				{#if node.children?.length > 0}
					<button class="toggle-btn" onclick={() => toggleCollapse(node.id)}>
						<svg
							class="toggle-icon"
							class:rotated={!collapsed.has(node.id)}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				{:else}
					<div class="toggle-spacer"></div>
				{/if}

				<!-- Node content -->
				<a href="/admin/org-structure/{node.id}" class="node-content">
					<div class="node-name">{node.name}</div>
					<div class="node-meta">
						{#if node.head_name}
							<span class="node-head">
								<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
								</svg>
								{node.head_name}
							</span>
						{:else}
							<span class="node-no-head">ยังไม่กำหนดหัวหน้า</span>
						{/if}
						{#if node.children?.length > 0}
							<span class="node-count">{countDescendants(node)} หน่วยย่อย</span>
						{/if}
					</div>
				</a>

				<!-- Actions (only for managers) -->
				{#if canManage}
				<div class="node-actions">
					<button onclick={() => { createParentId = node.id; showCreateModal = true; }} class="action-btn add-btn" title="เพิ่มหน่วยย่อย">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
					</button>
					<button onclick={() => (editingUnit = node)} class="action-btn edit-btn">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
					</button>
					<form method="POST" action="?/delete" use:enhance class="inline-form">
						<input type="hidden" name="id" value={node.id} />
						<button
							type="submit"
							onclick={(e) => swalConfirmDelete(e, node.name)}
							class="action-btn delete-btn"
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</form>
				</div>
				{/if}
			</div>

			<!-- Children -->
			{#if node.children?.length > 0 && !collapsed.has(node.id)}
				<div class="tree-children">
					{#each node.children as child}
						{@render unitNode(child, depth + 1)}
					{/each}
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

<div class="page-container">
	<BackButton href="/org-management" label="กลับหน้าโครงสร้างองค์กร" />

	<div class="page-header">
		<div>
			<h1 class="page-title">โครงสร้างองค์กร</h1>
			<p class="page-subtitle">
				จัดการแผนกและหน่วยงาน แบบ Tree Hierarchy
				<span class="unit-count">{data.units.length} หน่วยงาน</span>
			</p>
		</div>
		<div style="display: flex; gap: 10px; flex-shrink: 0;">
			{#if canManage}
				<button onclick={() => (showImportModal = true)} class="btn-secondary">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
					</svg>
					นำเข้า CSV
				</button>
			{/if}
			<button onclick={handleExportCsv} class="btn-secondary">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				ส่งออก CSV
			</button>
			{#if canManage}
				<button onclick={() => { createParentId = null; showCreateModal = true; }} class="btn-primary">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
					สร้างแผนก
				</button>
			{/if}
		</div>
	</div>

	<!-- Toast notifications handled by global Toast component -->

	<!-- Search & Filter -->
	<div class="filter-bar">
		<div class="search-wrap">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				type="text"
				placeholder="ค้นหาแผนก หรือชื่อหัวหน้า..."
				bind:value={searchQuery}
				class="search-input"
			/>
			{#if searchQuery}
				<button class="search-clear" onclick={() => (searchQuery = '')}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Tree View -->
	<div class="tree-container">
		{#if tree.length === 0}
			<div class="empty-state">ยังไม่มีข้อมูลโครงสร้างองค์กร</div>
		{:else}
			{#each tree as rootNode}
				{@render unitNode(rootNode, 0)}
			{/each}
		{/if}
	</div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
{@const createParentUnit = createParentId ? data.units.find((u: any) => u.id === createParentId) : null}
	<div class="modal-backdrop" onclick={() => (showCreateModal = false)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<h2 class="modal-title">{createParentUnit ? `เพิ่มหน่วยย่อยภายใต้ "${createParentUnit.name}"` : 'สร้างแผนกใหม่'}</h2>
			<form method="POST" action="?/create" use:enhance={() => {
				return async ({ update }) => { showCreateModal = false; createParentId = null; await update(); };
			}}>
				<div class="modal-body">
					<div class="form-field">
						<label class="form-label">ชื่อแผนก <span class="required">*</span></label>
						<input name="name" required class="form-input" placeholder={createParentUnit ? `เช่น หน่วยย่อยของ ${createParentUnit.name}` : 'เช่น ศัลยกรรมทั่วไป'} />
					</div>
					{#if createParentUnit}
						<input type="hidden" name="agency_id" value={createParentUnit.agency_id} />
						<input type="hidden" name="parent_id" value={createParentUnit.id} />
						<div class="form-field">
							<label class="form-label">สังกัด</label>
							<div class="form-readonly">{createParentUnit.name}</div>
						</div>
					{:else}
						<div class="form-field">
							<label class="form-label">หน่วยงาน <span class="required">*</span></label>
							<CustomSelect name="agency_id" required options={data.agencies.map((a: any) => ({ value: String(a.id), label: a.name }))} placeholder="-- เลือกหน่วยงาน --" class="mt-1" />
						</div>
						<div class="form-field">
							<label class="form-label">แผนกแม่ (Parent)</label>
							<CustomSelect name="parent_id" options={data.units.map((u: any) => ({ value: String(u.id), label: u.name }))} placeholder="-- ระดับสูงสุด (Root) --" class="mt-1" />
						</div>
					{/if}
					<div class="form-field">
						<label class="form-label">หัวหน้าหน่วยงาน</label>
						<CustomSelect name="head_of_unit_id" options={data.users.map((u: any) => ({ value: String(u.id), label: u.name }))} placeholder="-- ไม่ระบุ --" class="mt-1" />
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" onclick={() => { showCreateModal = false; createParentId = null; }} class="btn-ghost">ยกเลิก</button>
					<button type="submit" class="btn-primary">บันทึก</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Modal -->
{#if editingUnit}
	<div class="modal-backdrop" onclick={() => (editingUnit = null)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<h2 class="modal-title">แก้ไขแผนก</h2>
			<form method="POST" action="?/update" use:enhance={() => {
				return async ({ update }) => { editingUnit = null; await update(); };
			}}>
				<input type="hidden" name="id" value={editingUnit.id} />
				<div class="modal-body">
					<div class="form-field">
						<label class="form-label">ชื่อแผนก</label>
						<input name="name" value={editingUnit.name} required class="form-input" />
					</div>
					<div class="form-field">
						<label class="form-label">แผนกแม่</label>
						<CustomSelect name="parent_id" options={data.units.filter((u) => u.id !== editingUnit.id).map(u => ({ value: String(u.id), label: u.name }))} value={editingUnit.parent_id ? String(editingUnit.parent_id) : ''} placeholder="-- ระดับสูงสุด --" class="mt-1" />
					</div>
					<div class="form-field">
						<label class="form-label">หัวหน้าหน่วยงาน</label>
						<CustomSelect name="head_of_unit_id" options={data.users.map(u => ({ value: String(u.id), label: u.name }))} value={editingUnit.head_of_unit_id ? String(editingUnit.head_of_unit_id) : ''} placeholder="-- ไม่ระบุ --" class="mt-1" />
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" onclick={() => (editingUnit = null)} class="btn-ghost">ยกเลิก</button>
					<button type="submit" class="btn-primary">บันทึก</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Import CSV Modal -->
{#if showImportModal}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="modal-backdrop" onclick={() => (showImportModal = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<h2 class="modal-title">นำเข้าโครงสร้างองค์กรจาก CSV</h2>
			<p style="margin: 4px 0 0; font-size: 0.8125rem; color: oklch(0.5 0.02 180);">อัปโหลดไฟล์ CSV ที่มีข้อมูลแผนก/กอง</p>

			<div style="margin-top: 12px; padding: 14px; border-radius: 10px; border: 1px dashed oklch(0.82 0.015 180); background: oklch(0.98 0.005 180);">
				<p style="margin: 0 0 6px; font-size: 0.75rem; color: oklch(0.5 0.02 180);">คอลัมน์ที่รองรับ:</p>
				<p style="margin: 0; font-size: 0.75rem; font-family: monospace; color: oklch(0.35 0.02 180);">ชื่อแผนก*, รหัสหน่วยงาน*, รหัสแผนกแม่, รหัสหัวหน้า</p>
				<p style="margin: 4px 0 0; font-size: 0.6875rem; color: oklch(0.6 0.02 180);">* = จำเป็น | แผนกที่ซ้ำในระดับเดียวกันจะถูกข้าม</p>
				<button type="button" onclick={() => downloadCsvTemplate('org-structure',
					['ชื่อแผนก', 'รหัสหน่วยงาน', 'รหัสแผนกแม่', 'รหัสหัวหน้า'],
					[
						['กองคลัง', '1', '', ''],
						['กองช่าง', '1', '', '3'],
						['กองพัสดุ', '1', '', ''],
						['พัสดุการแพทย์', '1', '3', '5'],
						['พัสดุทั่วไป', '1', '3', ''],
					]
				)} style="margin-top: 8px; font-size: 0.75rem; color: oklch(0.42 0.12 240); background: none; border: none; cursor: pointer; text-decoration: underline;">
					ดาวน์โหลด Template CSV
				</button>
			</div>

			<form method="POST" action="?/importCsv" enctype="multipart/form-data" use:enhance={() => {
				return async ({ update }) => {
					showImportModal = false;
					await update();
				};
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
	.page-container {
		animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* ── Header ── */
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin: 20px 0 24px;
		gap: 16px;
	}

	.page-title {
		margin: 0 0 4px 0;
		font-size: clamp(1.375rem, 1.1rem + 0.7vw, 1.625rem);
		font-weight: 700;
		color: oklch(0.2 0.02 180);
		letter-spacing: -0.01em;
	}

	.page-subtitle {
		margin: 0;
		font-size: 0.875rem;
		color: oklch(0.5 0.02 180);
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.unit-count {
		padding: 2px 10px;
		border-radius: 6px;
		background: oklch(0.52 0.14 240 / 0.08);
		color: oklch(0.42 0.12 240);
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* ── Buttons ── */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 18px;
		border-radius: 10px;
		border: none;
		background: oklch(0.52 0.14 240);
		color: oklch(0.98 0.005 180);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: transform 0.15s ease, opacity 0.15s ease;
	}

	.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

	.btn-secondary {
		display: inline-flex; align-items: center; gap: 6px;
		padding: 8px 16px; border-radius: 10px;
		border: 1px solid oklch(0.88 0.01 180);
		background: oklch(0.98 0.005 180); color: oklch(0.35 0.02 180);
		font-size: 0.875rem; font-weight: 500; cursor: pointer;
		transition: background 0.15s ease;
	}
	.btn-secondary:hover { background: oklch(0.95 0.005 180); }

	.btn-ghost {
		padding: 8px 16px;
		border-radius: 10px;
		border: none;
		background: none;
		color: oklch(0.45 0.02 180);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.btn-ghost:hover { background: oklch(0.95 0.005 180); }

	.btn-icon { width: 16px; height: 16px; }

	/* ── Filter Bar ── */
	.filter-bar {
		margin-bottom: 20px;
	}

	.search-wrap {
		position: relative;
		max-width: 400px;
	}

	.search-icon {
		position: absolute;
		left: 14px;
		top: 50%;
		transform: translateY(-50%);
		width: 18px;
		height: 18px;
		color: oklch(0.55 0.02 180);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 10px 40px 10px 42px;
		border: 1px solid oklch(0.82 0.015 180);
		border-radius: 10px;
		background: oklch(0.995 0.002 180);
		font-family: 'Noto Sans Thai', sans-serif;
		font-size: 0.875rem;
		color: oklch(0.25 0.02 180);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.search-input:focus {
		outline: none;
		border-color: oklch(0.52 0.14 240);
		box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12);
	}

	.search-clear {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		width: 24px;
		height: 24px;
		border-radius: 6px;
		border: none;
		background: none;
		color: oklch(0.55 0.02 180);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.search-clear svg { width: 14px; height: 14px; }
	.search-clear:hover { background: oklch(0.92 0.005 180); }

	/* ── Tree Container ── */
	.tree-container {
		max-height: calc(100vh - 280px);
		overflow-y: auto;
		padding-right: 4px;
	}

	.tree-container::-webkit-scrollbar {
		width: 6px;
	}

	.tree-container::-webkit-scrollbar-track {
		background: transparent;
	}

	.tree-container::-webkit-scrollbar-thumb {
		background: oklch(0.82 0.01 180);
		border-radius: 3px;
	}

	/* ── Tree Node ── */
	.tree-node {
		padding-left: calc(var(--depth) * 28px);
	}

	.node-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		margin-bottom: 4px;
		border-radius: 12px;
		background: oklch(0.995 0.002 180);
		border: 1px solid oklch(0.94 0.005 180);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.node-row:hover {
		border-color: oklch(0.52 0.14 240 / 0.15);
		box-shadow: 0 2px 8px oklch(0.52 0.14 240 / 0.05);
	}

	.toggle-btn {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: none;
		background: none;
		color: oklch(0.5 0.02 180);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.toggle-btn:hover { background: oklch(0.92 0.005 180); }

	.toggle-icon {
		width: 14px;
		height: 14px;
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.toggle-icon.rotated { transform: rotate(90deg); }

	.toggle-spacer { width: 28px; flex-shrink: 0; }

	.node-content {
		flex: 1;
		min-width: 0;
		text-decoration: none;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.node-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: oklch(0.2 0.02 180);
		transition: color 0.15s ease;
	}

	.node-content:hover .node-name { color: oklch(0.52 0.14 240); }

	.node-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 0.75rem;
	}

	.node-head {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: oklch(0.45 0.02 180);
	}

	.meta-icon { width: 12px; height: 12px; }

	.node-no-head {
		color: oklch(0.65 0.01 180);
	}

	.node-count {
		color: oklch(0.52 0.14 240);
		font-weight: 500;
	}

	/* ── Node Actions ── */
	.node-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s ease;
		flex-shrink: 0;
	}

	.node-row:hover .node-actions { opacity: 1; }

	.action-btn {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: none;
		background: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease;
	}

	.action-btn svg { width: 16px; height: 16px; }

	.edit-btn { color: oklch(0.52 0.14 240); }
	.edit-btn:hover { background: oklch(0.52 0.14 240 / 0.08); }
	.add-btn { color: oklch(0.54 0.16 150); }
	.add-btn:hover { background: oklch(0.54 0.16 150 / 0.08); }

	.form-readonly {
		padding: 10px 14px; border-radius: 10px;
		background: oklch(0.97 0.005 180); border: 1px solid oklch(0.9 0.005 180);
		font-size: 0.9375rem; color: oklch(0.45 0.02 180);
	}

	.delete-btn { color: oklch(0.58 0.2 25); }
	.delete-btn:hover { background: oklch(0.58 0.2 25 / 0.08); }

	.inline-form { display: inline; }

	.tree-children {
		animation: expand 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* ── Empty State ── */
	.empty-state {
		text-align: center;
		padding: 48px 24px;
		font-size: 0.9375rem;
		color: oklch(0.55 0.02 180);
		background: oklch(0.98 0.005 180);
		border: 1px solid oklch(0.92 0.005 180);
		border-radius: 14px;
	}

	/* ── Modal ── */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background: oklch(0.15 0.02 180 / 0.5);
		backdrop-filter: blur(4px);
		animation: fade-in 0.2s ease;
	}

	.modal-card {
		width: 100%;
		max-width: 520px;
		background: oklch(0.995 0.002 180);
		border-radius: 18px;
		padding: 28px;
		box-shadow: 0 20px 60px oklch(0.15 0.02 180 / 0.2);
		animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.modal-title {
		margin: 0 0 20px 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: oklch(0.2 0.02 180);
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid oklch(0.92 0.005 180);
	}

	/* ── Form ── */
	.form-field { display: flex; flex-direction: column; gap: 6px; }

	.form-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.35 0.02 180);
	}

	.required { color: oklch(0.58 0.2 25); }

	.form-input {
		padding: 10px 14px;
		border: 1px solid oklch(0.82 0.015 180);
		border-radius: 10px;
		background: oklch(0.995 0.002 180);
		font-family: 'Noto Sans Thai', sans-serif;
		font-size: 0.9375rem;
		color: oklch(0.25 0.02 180);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.form-input:focus {
		outline: none;
		border-color: oklch(0.52 0.14 240);
		box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12);
	}

	/* ── Animations ── */
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes expand {
		from { opacity: 0; transform: translateY(-6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes scale-in {
		from { opacity: 0; transform: scale(0.96); }
		to { opacity: 1; transform: scale(1); }
	}

	/* ── Responsive ── */
	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
		}

		.tree-node {
			padding-left: calc(var(--depth) * 16px);
		}

		.node-actions { opacity: 1; }
	}
</style>
