<script lang="ts">
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import { formatThaiDateTime, exportToCsv } from '$lib/utils/format';

	let { data } = $props();
	let expandedId = $state<string | null>(null);
	let currentPage = $state(1);
	let searchQuery = $state('');
	let selectedFyId = $state<number | null>(null);
	const perPage = 15;

	$effect(() => {
		if (selectedFyId === null && data.fiscalYears?.length > 0) {
			selectedFyId = data.fiscalYears.find((fy: any) => fy.is_active)?.id ?? null;
		}
	});

	const allCollections = [
		{ key: 'plan_budget_histories', label: 'แผนงาน / งบประมาณ' },
		{ key: 'doc_payload_histories', label: 'เอกสารจัดซื้อจัดจ้าง' },
		{ key: 'bank_transaction_histories', label: 'การเบิกจ่าย / บัญชี' }
	];

	// Filter visible tabs: only show tabs for your PRIMARY domain (what you manage)
	let collections = $derived.by(() => {
		const u = data.user;
		if (u.is_super_admin || u.is_director) return allCollections;
		const p = u.permissions;
		return allCollections.filter((c) => {
			if (c.key === 'plan_budget_histories') return p.can_manage_plans;
			if (c.key === 'doc_payload_histories') return p.can_manage_procurement;
			if (c.key === 'bank_transaction_histories') return p.can_manage_finance;
			return false;
		});
	});

	const ACTION_STYLES: Record<string, { bg: string; color: string; label: string }> = {
		CREATE: { bg: 'oklch(0.54 0.16 150 / 0.1)', color: 'oklch(0.38 0.14 150)', label: 'สร้าง' },
		UPDATE: { bg: 'oklch(0.52 0.14 240 / 0.1)', color: 'oklch(0.42 0.12 240)', label: 'แก้ไข' },
		DELETE: { bg: 'oklch(0.58 0.2 25 / 0.1)', color: 'oklch(0.45 0.18 25)', label: 'ลบ' },
		STEP_ADVANCE: { bg: 'oklch(0.52 0.14 240 / 0.1)', color: 'oklch(0.42 0.12 240)', label: 'ดำเนินขั้นตอน' },
		STEP_APPROVED: { bg: 'oklch(0.54 0.16 150 / 0.1)', color: 'oklch(0.38 0.14 150)', label: 'อนุมัติขั้นตอน' },
		STEP_REJECTED: { bg: 'oklch(0.58 0.2 25 / 0.1)', color: 'oklch(0.45 0.18 25)', label: 'ปฏิเสธขั้นตอน' },
		GENERATE_DIKA: { bg: 'oklch(0.45 0.1 280 / 0.1)', color: 'oklch(0.40 0.1 280)', label: 'สร้างฎีกา' },
		DIKA_EXAMINED: { bg: 'oklch(0.62 0.18 60 / 0.1)', color: 'oklch(0.48 0.14 60)', label: 'ตรวจสอบฎีกา' },
		DIKA_APPROVED: { bg: 'oklch(0.54 0.16 150 / 0.1)', color: 'oklch(0.38 0.14 150)', label: 'อนุมัติฎีกา' },
		DIKA_REJECTED: { bg: 'oklch(0.58 0.2 25 / 0.1)', color: 'oklch(0.45 0.18 25)', label: 'ปฏิเสธฎีกา' },
		SYSTEM_SETTLE: { bg: 'oklch(0.54 0.16 150 / 0.1)', color: 'oklch(0.38 0.14 150)', label: 'จ่ายเงิน/ตัดบัญชี' }
	};

	let filteredRecords = $derived.by(() => {
		let records = data.records;
		// Filter by fiscal year (if record has fiscal_year_id in payload)
		if (selectedFyId) {
			records = records.filter((r: any) => {
				const fyId = r.payload_snapshot?.fiscal_year_id || r.fiscal_year_id;
				if (fyId) return fyId === selectedFyId;
				return true; // keep records without fiscal year info
			});
		}
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			records = records.filter((r: any) =>
				(r.action_by?.name || '').toLowerCase().includes(q) ||
				(r.action_type || '').toLowerCase().includes(q)
			);
		}
		return records;
	});

	let paginatedRecords = $derived(
		filteredRecords.slice((currentPage - 1) * perPage, currentPage * perPage)
	);
	let totalPages = $derived(Math.ceil(filteredRecords.length / perPage));

	function buildUrl(params: Record<string, string | number | null>) {
		const p = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) {
			if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
		}
		return `/audit?${p.toString()}`;
	}

	function switchCollection(col: string) {
		currentPage = 1;
		goto(buildUrl({ collection: col }));
	}

	async function onProvinceChange(val: string) {
		const form = new FormData();
		form.set('province_id', val || '');
		form.set('agency_id', '');
		await fetch('/org-management?/selectScope', { method: 'POST', body: form });
		location.reload();
	}

	async function onAgencyChange(val: string) {
		const form = new FormData();
		form.set('province_id', String(data.selectedProvinceId || ''));
		form.set('agency_id', val || '');
		await fetch('/org-management?/selectScope', { method: 'POST', body: form });
		location.reload();
	}

	function handleExportCsv() {
		exportToCsv('audit-trail', [
			{ key: 'action_type', label: 'ประเภท' },
			{ key: 'action_by_name', label: 'ผู้ดำเนินการ' },
			{ key: 'ip_address', label: 'IP Address' },
			{ key: 'created_at', label: 'วันที่' }
		], data.records.map((r: any) => ({
			...r,
			action_by_name: r.action_by?.name || 'ระบบ',
			ip_address: r.action_by?.ip_address || '-'
		})));
	}
</script>

<div class="page-container">
	<PageHeader title="ประวัติการเปลี่ยนแปลง" subtitle="ตรวจสอบย้อนหลังทุกการเปลี่ยนแปลง (Audit Trail)" />

	<!-- Super admin scope selector -->
	{#if data.user.is_super_admin}
		<div class="scope-bar">
			<div class="scope-field">
				<span class="scope-label">จังหวัด</span>
				<CustomSelect
					options={data.provinces.map((p: any) => ({ value: String(p.id), label: p.name }))}
					value={data.selectedProvinceId ? String(data.selectedProvinceId) : ''}
					placeholder="-- เลือกจังหวัด --"
					onchange={onProvinceChange}
					class="scope-select"
				/>
			</div>
			<div class="scope-field">
				<span class="scope-label" class:label-disabled={!data.selectedProvinceId}>หน่วยงาน</span>
				<CustomSelect
					options={data.agencies.map((a: any) => ({ value: String(a.id), label: a.name }))}
					value={data.selectedAgencyId ? String(data.selectedAgencyId) : ''}
					placeholder="-- เลือกหน่วยงาน --"
					disabled={!data.selectedProvinceId}
					onchange={onAgencyChange}
					class="scope-select"
				/>
			</div>
		</div>
	{/if}

	<!-- Actions + Filter -->
	<div class="toolbar">
		<div class="search-wrap">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input type="text" placeholder="ค้นหาผู้ดำเนินการ..." bind:value={searchQuery} class="search-input" />
		</div>
		<button onclick={handleExportCsv} class="btn-secondary">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
			ส่งออก CSV
		</button>
	</div>

	<!-- Collection Tabs -->
	<div class="tabs">
		{#each collections as col}
			<button
				onclick={() => switchCollection(col.key)}
				class="tab"
				class:tab-active={data.collection === col.key}
			>
				{col.label}
			</button>
		{/each}
		{#if data.selectedAgencyId}
			<span class="tab-count">{filteredRecords.length} รายการ</span>
		{/if}
	</div>

	<!-- Fiscal Year Filter -->
	{#if data.fiscalYears?.length > 0}
		<div class="fy-bar">
			<button class="fy-btn" class:fy-active={!selectedFyId} onclick={() => { selectedFyId = null; currentPage = 1; }}>ทุกปี</button>
			{#each data.fiscalYears as fy}
				<button class="fy-btn" class:fy-active={selectedFyId === fy.id} onclick={() => { selectedFyId = fy.id; currentPage = 1; }}>
					{fy.year_name}
					{#if fy.is_active}<span class="fy-dot"></span>{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if !data.selectedAgencyId && data.user.is_super_admin}
		<div class="empty-state">
			<div class="empty-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<h3 class="empty-title">เลือกจังหวัดและหน่วยงาน</h3>
			<p class="empty-desc">กรุณาเลือกจังหวัดและหน่วยงานด้านบนเพื่อดูประวัติการเปลี่ยนแปลง</p>
		</div>
	{:else}
		<!-- Records List -->
		<div class="records-scroll">
			{#each paginatedRecords as record}
				{@const style = ACTION_STYLES[record.action_type] || { bg: 'oklch(0.92 0.005 180)', color: 'oklch(0.45 0.02 180)', label: record.action_type }}
				<div class="record-card">
					<button
						onclick={() => (expandedId = expandedId === record._id ? null : record._id)}
						class="record-row"
					>
						<div class="record-left">
							<span class="action-badge" style="background: {style.bg}; color: {style.color};">
								{style.label}
							</span>
							<span class="record-name">{record.action_by?.name || 'ระบบ'}</span>
							<span class="record-ip">IP: {record.action_by?.ip_address || '-'}</span>
						</div>
						<div class="record-right">
							<span class="record-date">{record.created_at ? formatThaiDateTime(record.created_at) : '-'}</span>
							<svg class="expand-icon" class:expanded={expandedId === record._id} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
							</svg>
						</div>
					</button>

					{#if expandedId === record._id}
						<div class="record-detail">
							<!-- Structured summary -->
							<div class="detail-summary">
								{#if record.document_id}
									<div class="detail-item"><span class="detail-key">เอกสาร</span><span class="detail-val">#{record.document_id}</span></div>
								{/if}
								{#if record.step_name}
									<div class="detail-item"><span class="detail-key">ขั้นตอน</span><span class="detail-val">{record.step_name}</span></div>
								{/if}
								{#if record.dika_voucher_id}
									<div class="detail-item"><span class="detail-key">ฎีกา</span><span class="detail-val">#{record.dika_voucher_id}</span></div>
								{/if}
								{#if record.net_amount}
									<div class="detail-item"><span class="detail-key">ยอดสุทธิ</span><span class="detail-val">{Number(record.net_amount).toLocaleString('th-TH')} บาท</span></div>
								{/if}
								{#if record.comment}
									<div class="detail-item"><span class="detail-key">หมายเหตุ</span><span class="detail-val">{record.comment}</span></div>
								{/if}
								{#if record.amount_change}
									<div class="detail-item"><span class="detail-key">จำนวนเงิน</span><span class="detail-val">{Number((record.amount_change as any)?.['new'] || 0).toLocaleString('th-TH')} บาท</span></div>
								{/if}
							</div>
							<!-- Raw JSON toggle -->
							<details class="mt-2">
								<summary class="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">ดู JSON ทั้งหมด</summary>
								<pre class="detail-json">{JSON.stringify(record, null, 2)}</pre>
							</details>
						</div>
					{/if}
				</div>
			{:else}
				<div class="empty-records">ไม่มีข้อมูลประวัติการเปลี่ยนแปลง</div>
			{/each}
			{#each Array(Math.max(0, perPage - paginatedRecords.length)) as _}
				<div class="record-card filler-card">
					<div class="record-row filler-row">&nbsp;</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="pagination">
				<span class="page-info">หน้า {currentPage} จาก {totalPages}</span>
				<div class="page-btns">
					<button disabled={currentPage <= 1} onclick={() => (currentPage = Math.max(1, currentPage - 1))} class="page-btn">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
					</button>
					{#each Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1) as p}
						<button class="page-btn" class:page-active={p === currentPage} onclick={() => (currentPage = p)}>{p}</button>
					{/each}
					<button disabled={currentPage >= totalPages} onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))} class="page-btn">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page-container { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1); }

	/* Scope bar */
	.scope-bar { display: flex; align-items: center; gap: 20px; padding: 16px 20px; margin-bottom: 20px; border-radius: 14px; background: oklch(0.98 0.005 180); border: 1px solid oklch(0.9 0.005 180); }
	.scope-field { display: flex; align-items: center; gap: 10px; }
	.scope-label { font-size: 0.8125rem; font-weight: 500; color: oklch(0.4 0.02 180); white-space: nowrap; }
	.label-disabled { color: oklch(0.7 0.01 180); }
	.scope-select { padding: 8px 14px; border: 1px solid oklch(0.82 0.015 180); border-radius: 10px; background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif; font-size: 0.875rem; color: oklch(0.25 0.02 180); cursor: pointer; }
	.scope-select:focus { outline: none; border-color: oklch(0.52 0.14 240); box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12); }
	.select-disabled { opacity: 0.5; cursor: not-allowed; }

	/* Toolbar */
	.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
	.search-wrap { position: relative; flex: 1; max-width: 320px; }
	.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: oklch(0.55 0.02 180); pointer-events: none; }
	.search-input { width: 100%; padding: 9px 14px 9px 42px; border: 1px solid oklch(0.82 0.015 180); border-radius: 10px; background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif; font-size: 0.875rem; color: oklch(0.25 0.02 180); }
	.search-input:focus { outline: none; border-color: oklch(0.52 0.14 240); box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12); }

	.btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; border: 1px solid oklch(0.88 0.01 180); background: oklch(0.98 0.005 180); color: oklch(0.35 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; flex-shrink: 0; }
	.btn-secondary:hover { background: oklch(0.95 0.005 180); }
	.btn-icon { width: 16px; height: 16px; }

	/* Tabs */
	.tabs { display: flex; align-items: center; gap: 4px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid oklch(0.92 0.005 180); }
	.tab { padding: 8px 16px; border-radius: 8px; border: none; background: none; font-size: 0.875rem; font-weight: 500; color: oklch(0.5 0.02 180); cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
	.tab:hover { background: oklch(0.95 0.005 180); }
	.tab-active { background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.12 240); }
	.tab-count { margin-left: auto; padding: 3px 10px; border-radius: 6px; background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.12 240); font-size: 0.75rem; font-weight: 600; }

	/* Records */
	.records-scroll { max-height: calc(100vh - 400px); min-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
	.records-scroll::-webkit-scrollbar { width: 6px; }
	.records-scroll::-webkit-scrollbar-thumb { background: oklch(0.82 0.01 180); border-radius: 3px; }

	.record-card { border-radius: 12px; border: 1px solid oklch(0.92 0.005 180); background: oklch(0.995 0.002 180); overflow: hidden; transition: box-shadow 0.15s ease; }
	.record-card:hover { box-shadow: 0 2px 8px oklch(0.52 0.14 240 / 0.05); }

	.record-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 18px; border: none; background: none; cursor: pointer; text-align: left; gap: 12px; }

	.record-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
	.action-badge { padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
	.record-name { font-size: 0.875rem; font-weight: 500; color: oklch(0.2 0.02 180); }
	.record-ip { font-size: 0.75rem; color: oklch(0.55 0.02 180); }

	.record-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
	.record-date { font-size: 0.75rem; color: oklch(0.5 0.02 180); }
	.expand-icon { width: 16px; height: 16px; color: oklch(0.55 0.02 180); transition: transform 0.2s ease; }
	.expand-icon.expanded { transform: rotate(180deg); }

	.record-detail { border-top: 1px solid oklch(0.92 0.005 180); padding: 16px 18px; animation: slide-down 0.2s ease; }
	.detail-summary { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 8px; }
	.detail-item { display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; }
	.detail-key { color: oklch(0.5 0.02 180); font-weight: 500; }
	.detail-val { color: oklch(0.25 0.02 180); font-weight: 600; }
	.detail-json { margin: 0; padding: 14px; border-radius: 10px; background: oklch(0.97 0.005 180); font-size: 0.75rem; color: oklch(0.35 0.02 180); overflow-x: auto; font-family: 'Fira Code', monospace; line-height: 1.5; max-height: 300px; }

	.empty-records { text-align: center; padding: 48px 24px; font-size: 0.9375rem; color: oklch(0.55 0.02 180); background: oklch(0.98 0.005 180); border: 1px solid oklch(0.92 0.005 180); border-radius: 14px; }
	.filler-card { visibility: hidden; pointer-events: none; }
	.filler-row { padding: 14px 18px; }

	/* Empty state */
	.empty-state { display: flex; flex-direction: column; align-items: center; padding: 60px 24px; text-align: center; }
	.empty-icon { width: 72px; height: 72px; border-radius: 50%; margin-bottom: 20px; background: oklch(0.52 0.14 240 / 0.08); display: flex; align-items: center; justify-content: center; }
	.empty-icon svg { width: 36px; height: 36px; color: oklch(0.52 0.14 240); }
	.empty-title { margin: 0 0 8px 0; font-size: 1.125rem; font-weight: 600; color: oklch(0.25 0.02 180); }
	.empty-desc { margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180); max-width: 360px; }

	/* Pagination */
	.pagination { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; margin-top: 12px; }
	.page-info { font-size: 0.8125rem; color: oklch(0.5 0.02 180); }
	.page-btns { display: flex; gap: 4px; }
	.page-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); background: oklch(0.98 0.005 180); color: oklch(0.4 0.02 180); font-size: 0.8125rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; }
	.page-btn:hover:not(:disabled) { background: oklch(0.52 0.14 240 / 0.08); border-color: oklch(0.52 0.14 240 / 0.3); }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.page-btn svg { width: 14px; height: 14px; }
	.page-active { background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180); border-color: oklch(0.52 0.14 240); }

	/* Fiscal Year */
	.fy-bar { display: flex; gap: 2px; margin-bottom: 16px; }
	.fy-btn { padding: 6px 14px; border: none; border-radius: 8px; background: transparent; font-family: 'Noto Sans Thai', sans-serif; font-size: 0.8125rem; font-weight: 500; color: oklch(0.5 0.02 180); cursor: pointer; transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1); }
	.fy-btn:hover { color: oklch(0.4 0.04 180); background: oklch(0.52 0.14 240 / 0.04); }
	.fy-active { color: oklch(0.42 0.14 240); background: oklch(0.52 0.14 240 / 0.08); font-weight: 600; }
	.fy-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: oklch(0.54 0.16 150); margin-left: 4px; vertical-align: middle; }

	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes slide-down { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

	@media (max-width: 768px) {
		.scope-bar { flex-direction: column; align-items: flex-start; }
		.toolbar { flex-direction: column; align-items: stretch; }
		.search-wrap { max-width: none; }
		.record-left { flex-wrap: wrap; }
	}
</style>
