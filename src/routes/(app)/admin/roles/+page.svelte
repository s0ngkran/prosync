<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import { exportToCsv, downloadCsvTemplate } from '$lib/utils/format';
	import { watchFormResult } from '$lib/stores/toast.svelte';

	let { data, form }: { data: PageData; form: any } = $props();

	watchFormResult(() => form);

	let editingId = $state<number | null>(null);
	let editName = $state('');
	let editPermissions = $state<Record<string, Record<string, boolean>>>({});
	let showCreateForm = $state(false);
	let showImportModal = $state(false);
	let searchQuery = $state('');
	let filterGroup = $state('all');

	// Filter roles
	let filteredRoles = $derived.by(() => {
		let result = data.roles as any[];
		// Search by name
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			result = result.filter((r: any) =>
				r.name.toLowerCase().includes(q) ||
				getActivePermissions(r.permissions).some((p: any) => p.label.toLowerCase().includes(q))
			);
		}
		// Filter by permission group
		if (filterGroup !== 'all') {
			result = result.filter((r: any) => {
				const perms = r.permissions?.[filterGroup] ?? {};
				return Object.values(perms).some(Boolean);
			});
		}
		return result;
	});

	const PERMISSION_LABELS: Record<string, { label: string; icon: string; perms: Record<string, string> }> = {
		system: {
			label: 'ระบบ',
			icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
			perms: {
				can_manage_users: 'จัดการผู้ใช้งาน',
				can_manage_org_units: 'จัดการโครงสร้างองค์กร'
			}
		},
		planning: {
			label: 'แผนงาน',
			icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
			perms: {
				can_view_plan: 'ดูแผนงาน',
				can_create_plan: 'สร้างแผน',
				can_edit_plan: 'แก้ไขแผน',
				can_delete_plan: 'ลบแผน'
			}
		},
		procurement: {
			label: 'จัดซื้อจัดจ้าง',
			icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
			perms: {
				can_view_document: 'ดูเอกสารจัดซื้อ',
				can_create_document: 'สร้างเอกสารจัดซื้อ',
				can_approve_document: 'อนุมัติเอกสารจัดซื้อ'
			}
		},
		finance: {
			label: 'การเงิน',
			icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
			perms: {
				can_view_dika: 'ดูฎีกาเบิกจ่าย',
				can_create_dika: 'สร้างฎีกาเบิกจ่าย',
				can_approve_dika: 'อนุมัติฎีกาเบิกจ่าย'
			}
		},
		audit: {
			label: 'ตรวจสอบ',
			icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
			perms: {
				can_view_audit_trail: 'ดูประวัติการเปลี่ยนแปลง'
			}
		}
	};

	function getActivePermissions(permissions: any): { label: string; isView: boolean }[] {
		const active: { label: string; isView: boolean }[] = [];
		for (const [group, perms] of Object.entries(permissions ?? {})) {
			const groupDef = PERMISSION_LABELS[group];
			if (!groupDef) continue;
			for (const [key, val] of Object.entries(perms as Record<string, boolean>)) {
				if (val && groupDef.perms[key]) {
					active.push({ label: groupDef.perms[key], isView: key.startsWith('can_view') });
				}
			}
		}
		return active;
	}

	function startEdit(role: any) {
		editingId = role.id;
		editName = role.name;
		editPermissions = structuredClone(role.permissions);
	}

	function cancelEdit() {
		editingId = null;
		editName = '';
		editPermissions = {};
	}

	function handleExportCsv() {
		exportToCsv('roles', [
			{ key: 'name', label: 'ชื่อบทบาท' },
			{ key: 'permissions_summary', label: 'สิทธิ์' }
		], data.roles.map((r: any) => ({
			...r,
			permissions_summary: getActivePermissions(r.permissions).map(p => p.label).join(', ')
		})));
	}
</script>

{#snippet permissionGrid(namePrefix: string, existingPerms?: Record<string, Record<string, boolean>>)}
	<div class="perm-grid">
		{#each Object.entries(PERMISSION_LABELS) as [group, groupDef]}
			<div class="perm-group">
				<div class="perm-group-header">
					<svg class="perm-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d={groupDef.icon} />
					</svg>
					<span>{groupDef.label}</span>
				</div>
				<div class="perm-list">
					{#each Object.entries(groupDef.perms) as [key, label]}
						{@const isView = key.startsWith('can_view')}
						<label class="perm-item" class:perm-view={isView}>
							<input
								type="checkbox"
								name="{namePrefix}.{group}.{key}"
								checked={existingPerms?.[group]?.[key] ?? false}
								class="perm-checkbox"
							/>
							<span class="perm-label-text">
								{label}
								{#if isView}
									<span class="perm-tag view">ดูอย่างเดียว</span>
								{/if}
							</span>
						</label>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

<div class="page-container">
	<BackButton href="/org-management" label="กลับหน้าโครงสร้างองค์กร" />

	<div class="page-header">
		<div>
			<h1 class="page-title">จัดการบทบาทและสิทธิ์</h1>
			<p class="page-subtitle">
				สร้าง แก้ไข ลบ บทบาท พร้อมกำหนดสิทธิ์การใช้งาน
				<span class="role-count">{data.roles.length} บทบาท</span>
			</p>
		</div>
		<div class="header-actions">
			<button onclick={() => (showImportModal = true)} class="btn-secondary">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
				</svg>
				นำเข้า CSV
			</button>
			<button onclick={handleExportCsv} class="btn-secondary">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				ส่งออก CSV
			</button>
			<button onclick={() => (showCreateForm = !showCreateForm)} class="btn-primary">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				เพิ่มบทบาท
			</button>
		</div>
	</div>

	<!-- Create Form (collapsible) -->
	{#if showCreateForm}
		<div class="create-card">
			<h2 class="create-title">เพิ่มบทบาทใหม่</h2>
			<form method="POST" action="?/create" use:enhance={() => {
				return async ({ update }) => { showCreateForm = false; await update(); };
			}} class="create-form">
				<div class="form-field">
					<label for="create-name" class="form-label">ชื่อบทบาท <span class="required">*</span></label>
					<input id="create-name" type="text" name="name" required maxlength="100" placeholder="เช่น เจ้าหน้าที่พัสดุ" class="form-input" />
				</div>
				<div class="form-field">
					<label class="form-label">สิทธิ์การใช้งาน</label>
					{@render permissionGrid('perm')}
				</div>
				<div class="form-actions">
					<button type="button" onclick={() => (showCreateForm = false)} class="btn-ghost">ยกเลิก</button>
					<button type="submit" class="btn-primary">เพิ่มบทบาท</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Filter Bar -->
	<div class="filter-bar">
		<div class="search-wrap">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input type="text" placeholder="ค้นหาบทบาท หรือสิทธิ์..." bind:value={searchQuery} class="search-input" />
			{#if searchQuery}
				<button class="search-clear" onclick={() => (searchQuery = '')}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			{/if}
		</div>
		<div class="filter-chips">
			<button class="chip" class:chip-active={filterGroup === 'all'} onclick={() => (filterGroup = 'all')}>ทั้งหมด</button>
			{#each Object.entries(PERMISSION_LABELS) as [group, groupDef]}
				<button class="chip" class:chip-active={filterGroup === group} onclick={() => (filterGroup = group)}>{groupDef.label}</button>
			{/each}
		</div>
	</div>

	<!-- Scrollable Roles List -->
	<div class="roles-scroll">
		<div class="roles-list">
			{#each filteredRoles as role}
				{#if editingId === role.id}
					<div class="role-card editing">
						<form method="POST" action="?/update" use:enhance={() => {
							return async ({ update }) => { await update(); cancelEdit(); };
						}} class="edit-form">
							<input type="hidden" name="id" value={role.id} />
							<div class="form-field">
								<label for="edit-name-{role.id}" class="form-label">ชื่อบทบาท</label>
								<input id="edit-name-{role.id}" type="text" name="name" required maxlength="100" bind:value={editName} class="form-input" />
							</div>
							<div class="form-field">
								<label class="form-label">สิทธิ์การใช้งาน</label>
								{@render permissionGrid('perm', editPermissions)}
							</div>
							<div class="form-actions">
								<button type="button" onclick={() => cancelEdit()} class="btn-ghost">ยกเลิก</button>
								<button type="submit" class="btn-primary">บันทึก</button>
							</div>
						</form>
					</div>
				{:else}
					<div class="role-card">
						<div class="role-header">
							<h3 class="role-name">{role.name}</h3>
							<div class="role-actions">
								<button onclick={() => startEdit(role)} class="action-btn edit">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-icon">
										<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
									แก้ไข
								</button>
								<form method="POST" action="?/delete" use:enhance class="inline-form">
									<input type="hidden" name="id" value={role.id} />
									<button type="submit" onclick={(e) => { if (!confirm('ลบบทบาทนี้?')) e.preventDefault(); }} class="action-btn delete">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-icon">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
										ลบ
									</button>
								</form>
							</div>
						</div>
						<div class="role-perms">
							{#if getActivePermissions(role.permissions).length > 0}
								<div class="perm-badges">
									{#each getActivePermissions(role.permissions) as perm}
										<span class="perm-badge" class:view-badge={perm.isView}>{perm.label}</span>
									{/each}
								</div>
							{:else}
								<span class="no-perms">ไม่มีสิทธิ์</span>
							{/if}
						</div>
					</div>
				{/if}
			{:else}
				<div class="empty-state">
					{#if searchQuery || filterGroup !== 'all'}
						ไม่พบบทบาทที่ตรงกับเงื่อนไข
					{:else}
						ยังไม่มีบทบาทในระบบ
					{/if}
				</div>
			{/each}
		</div>
	</div>

	{#if filteredRoles.length > 0}
		<div class="list-footer">
			แสดง {filteredRoles.length} จาก {data.roles.length} บทบาท
		</div>
	{/if}
</div>

<!-- Import CSV Modal -->
{#if showImportModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
			<h2 class="text-lg font-bold text-gray-900">นำเข้าบทบาทจาก CSV</h2>
			<p class="mt-1 text-sm text-gray-500">อัปโหลดไฟล์ CSV ที่มีข้อมูลบทบาท</p>

			<div class="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
				<p class="text-xs text-gray-500 mb-2">คอลัมน์ที่รองรับ:</p>
				<p class="text-xs text-gray-600 font-mono">ชื่อบทบาท*, สิทธิ์</p>
				<p class="text-xs text-gray-400 mt-1">* = จำเป็น | คอลัมน์สิทธิ์ใส่ชื่อสิทธิ์คั่นด้วย , เช่น "จัดการผู้ใช้งาน, ดูแผนงาน"</p>
				<button type="button" onclick={() => downloadCsvTemplate('roles', ['ชื่อบทบาท', 'สิทธิ์'])} class="mt-2 text-xs text-blue-600 hover:underline cursor-pointer">
					ดาวน์โหลด Template CSV
				</button>
			</div>

			<form method="POST" action="?/importCsv" enctype="multipart/form-data" use:enhance={() => {
				return async ({ update }) => {
					showImportModal = false;
					await update();
				};
			}}>
				<div class="mt-4">
					<input name="csv_file" type="file" accept=".csv" required class="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
				</div>
				<div class="mt-6 flex justify-end gap-2">
					<button type="button" onclick={() => (showImportModal = false)} class="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
						ยกเลิก
					</button>
					<button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
						นำเข้า
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.page-container {
		animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

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

	.role-count {
		padding: 2px 10px;
		border-radius: 6px;
		background: oklch(0.52 0.14 240 / 0.08);
		color: oklch(0.42 0.12 240);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.header-actions { display: flex; gap: 10px; flex-shrink: 0; }

	/* ── Buttons ── */
	.btn-primary {
		display: inline-flex; align-items: center; gap: 6px;
		padding: 8px 18px; border-radius: 10px; border: none;
		background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180);
		font-size: 0.875rem; font-weight: 500; cursor: pointer;
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
		padding: 8px 16px; border-radius: 10px; border: none; background: none;
		color: oklch(0.45 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer;
	}
	.btn-ghost:hover { background: oklch(0.95 0.005 180); }
	.btn-icon { width: 16px; height: 16px; }

	/* ── Filter Bar ── */
	.filter-bar {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.search-wrap {
		position: relative;
		min-width: 260px;
		flex: 1;
		max-width: 380px;
	}

	.search-icon {
		position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
		width: 18px; height: 18px; color: oklch(0.55 0.02 180); pointer-events: none;
	}

	.search-input {
		width: 100%; padding: 9px 36px 9px 42px;
		border: 1px solid oklch(0.82 0.015 180); border-radius: 10px;
		background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif;
		font-size: 0.875rem; color: oklch(0.25 0.02 180);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.search-input:focus {
		outline: none; border-color: oklch(0.52 0.14 240);
		box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12);
	}

	.search-clear {
		position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
		width: 24px; height: 24px; border-radius: 6px; border: none; background: none;
		color: oklch(0.55 0.02 180); cursor: pointer; display: flex; align-items: center; justify-content: center;
	}
	.search-clear svg { width: 14px; height: 14px; }
	.search-clear:hover { background: oklch(0.92 0.005 180); }

	.filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }

	.chip {
		padding: 6px 14px; border-radius: 8px;
		border: 1px solid oklch(0.88 0.01 180);
		background: oklch(0.98 0.005 180); color: oklch(0.45 0.02 180);
		font-size: 0.8125rem; font-weight: 500; cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}
	.chip:hover { background: oklch(0.95 0.005 180); }
	.chip-active {
		background: oklch(0.52 0.14 240 / 0.08);
		border-color: oklch(0.52 0.14 240 / 0.3);
		color: oklch(0.42 0.12 240);
	}

	/* ── Scrollable Roles ── */
	.roles-scroll {
		max-height: calc(100vh - 320px);
		min-height: 300px;
		overflow-y: auto;
		padding-right: 4px;
	}

	.roles-scroll::-webkit-scrollbar { width: 6px; }
	.roles-scroll::-webkit-scrollbar-track { background: transparent; }
	.roles-scroll::-webkit-scrollbar-thumb { background: oklch(0.82 0.01 180); border-radius: 3px; }

	.roles-list { display: flex; flex-direction: column; gap: 10px; }

	/* ── Create Card ── */
	.create-card {
		background: oklch(0.98 0.005 180); border: 1px solid oklch(0.88 0.01 180);
		border-radius: 16px; padding: 28px; margin-bottom: 20px;
		animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.create-title { margin: 0 0 20px 0; font-size: 1.0625rem; font-weight: 600; color: oklch(0.25 0.02 180); }
	.create-form { display: flex; flex-direction: column; gap: 20px; }

	/* ── Form ── */
	.form-field { display: flex; flex-direction: column; gap: 6px; }
	.form-label { font-size: 0.8125rem; font-weight: 500; color: oklch(0.35 0.02 180); }
	.required { color: oklch(0.58 0.2 25); }

	.form-input {
		padding: 10px 14px; border: 1px solid oklch(0.82 0.015 180); border-radius: 10px;
		background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif;
		font-size: 0.9375rem; color: oklch(0.25 0.02 180);
		transition: border-color 0.2s ease, box-shadow 0.2s ease; max-width: 400px;
	}
	.form-input:focus { outline: none; border-color: oklch(0.52 0.14 240); box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12); }

	.form-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; }

	/* ── Permission Grid ── */
	.perm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }

	.perm-group {
		padding: 14px; border-radius: 12px;
		background: oklch(0.995 0.002 180); border: 1px solid oklch(0.92 0.005 180);
	}

	.perm-group-header {
		display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
		font-size: 0.875rem; font-weight: 600; color: oklch(0.3 0.02 180);
	}
	.perm-group-icon { width: 18px; height: 18px; color: oklch(0.52 0.14 240); }

	.perm-list { display: flex; flex-direction: column; gap: 6px; }

	.perm-item {
		display: flex; align-items: center; gap: 8px; padding: 5px 0;
		font-size: 0.8125rem; color: oklch(0.35 0.02 180); cursor: pointer;
	}
	.perm-item.perm-view { color: oklch(0.45 0.02 180); }

	.perm-checkbox {
		width: 16px; height: 16px; border-radius: 4px;
		border: 1.5px solid oklch(0.75 0.02 180); accent-color: oklch(0.52 0.14 240);
	}

	.perm-label-text { display: flex; align-items: center; gap: 6px; }

	.perm-tag { font-size: 0.6875rem; padding: 1px 6px; border-radius: 4px; font-weight: 500; }
	.perm-tag.view { background: oklch(0.62 0.18 60 / 0.12); color: oklch(0.5 0.14 60); }

	/* ── Role Card ── */
	.role-card {
		background: oklch(0.995 0.002 180); border: 1px solid oklch(0.92 0.005 180);
		border-radius: 14px; padding: 18px 22px;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.role-card:hover { box-shadow: 0 4px 16px oklch(0.52 0.14 240 / 0.06); }

	.role-card.editing {
		background: oklch(0.52 0.14 240 / 0.03);
		border-color: oklch(0.52 0.14 240 / 0.2); padding: 24px;
	}
	.edit-form { display: flex; flex-direction: column; gap: 20px; }

	.role-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }

	.role-name { margin: 0; font-size: 1rem; font-weight: 600; color: oklch(0.2 0.02 180); }

	.role-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s ease; }
	.role-card:hover .role-actions { opacity: 1; }

	.action-btn {
		display: inline-flex; align-items: center; gap: 4px;
		padding: 5px 10px; border-radius: 8px; border: none; background: none;
		font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: background 0.15s ease;
	}
	.action-btn.edit { color: oklch(0.52 0.14 240); }
	.action-btn.edit:hover { background: oklch(0.52 0.14 240 / 0.08); }
	.action-btn.delete { color: oklch(0.58 0.2 25); }
	.action-btn.delete:hover { background: oklch(0.58 0.2 25 / 0.08); }
	.action-icon { width: 14px; height: 14px; }
	.inline-form { display: inline; }

	/* ── Permission Badges ── */
	.role-perms { display: flex; flex-direction: column; gap: 6px; }
	.perm-badges { display: flex; flex-wrap: wrap; gap: 6px; }

	.perm-badge {
		display: inline-block; padding: 3px 10px; border-radius: 6px;
		font-size: 0.75rem; font-weight: 500;
		background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.12 240);
	}
	.perm-badge.view-badge { background: oklch(0.62 0.18 60 / 0.1); color: oklch(0.48 0.14 60); }

	.no-perms { font-size: 0.8125rem; color: oklch(0.6 0.015 180); }

	/* ── Footer ── */
	.list-footer {
		padding: 12px 0;
		font-size: 0.8125rem;
		color: oklch(0.55 0.02 180);
		text-align: center;
	}

	/* ── Empty ── */
	.empty-state {
		text-align: center; padding: 48px 24px;
		font-size: 0.9375rem; color: oklch(0.55 0.02 180);
		background: oklch(0.98 0.005 180); border: 1px solid oklch(0.92 0.005 180); border-radius: 14px;
	}

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes slide-down { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }

	@media (max-width: 768px) {
		.page-header { flex-direction: column; }
		.filter-bar { flex-direction: column; align-items: stretch; }
		.search-wrap { max-width: none; }
		.perm-grid { grid-template-columns: 1fr; }
	}
</style>
