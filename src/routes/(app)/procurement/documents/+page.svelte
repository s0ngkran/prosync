<script lang="ts">
	import { enhance } from '$app/forms';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ScopeSelector from '$lib/components/ScopeSelector.svelte';
	import BackButton from '$lib/components/BackButton.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import { formatBaht } from '$lib/utils/format';
	import { watchFormResult } from '$lib/stores/toast.svelte';
	import { BILL_SECTION_LABELS } from '$lib/types/procurement';

	let { data, form: formResult } = $props();
	watchFormResult(() => formResult);

	let searchQuery = $state('');

	const docTypeLabels: Record<string, string> = {
		type1_nParcel: 'ซื้อครั้งเดียว',
		type2_iParcelUtil: 'สาธารณูปโภค',
		type3_iParcel: 'ซ่อมบำรุง'
	};

	const methodLabels: Record<string, string> = {
		specific_lte100k: 'เฉพาะเจาะจง (≤100K)',
		specific_gt100k: 'เฉพาะเจาะจง (>100K)',
		selection: 'คัดเลือก',
		e_bidding: 'e-Bidding',
		e_market: 'e-Market'
	};

	// Filter: only v2 execution-phase docs (type1/2/3) + legacy docs
	let v2Docs = $derived(
		data.documents.filter((d: any) => d.doc_type && d.phase === 'EXECUTION' && ['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel'].includes(d.doc_type))
	);
	let legacyDocs = $derived(
		data.documents.filter((d: any) => !d.doc_type || d.phase === 'LEGACY')
	);

	let filteredV2 = $derived(
		v2Docs.filter((d: any) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return d.plan_title?.toLowerCase().includes(q) || String(d.id).includes(q);
		})
	);

	let filteredLegacy = $derived(
		legacyDocs.filter((d: any) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return (d.workflow_name ?? '').toLowerCase().includes(q) || (d.plan_title ?? '').toLowerCase().includes(q) || String(d.id).includes(q);
		})
	);

	let showLegacy = $state(false);
</script>

<div>
	<BackButton href="/procurement" label="กลับหน้าจัดซื้อจัดจ้าง" />

	<div style="display: flex; justify-content: space-between; align-items: flex-start; margin: 20px 0 24px; gap: 16px">
		<div>
			<h1 style="margin: 0 0 4px; font-size: clamp(1.375rem, 1.1rem + 0.7vw, 1.625rem); font-weight: 700; color: oklch(0.2 0.02 180)">เอกสารจัดซื้อจัดจ้าง</h1>
			<p style="margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180)">
				เอกสารที่ผ่านการอนุมัติแล้ว — รอฝ่ายจัดซื้อดำเนินการ
				<span style="margin-left: 8px; padding: 2px 10px; border-radius: 6px; background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.14 240); font-size: 0.75rem; font-weight: 600">{v2Docs.length} รายการ</span>
			</p>
		</div>
	</div>

	{#if data.user.is_super_admin}
		<ScopeSelector
			provinces={data.provinces}
			agencies={data.agencies}
			orgUnits={[]}
			selectedProvinceId={data.selectedProvinceId}
			selectedAgencyId={data.selectedAgencyId}
			isSuperAdmin={true}
			basePath="/procurement/documents"
			compact={true}
		/>
	{/if}

	<!-- Search -->
	<div style="margin-bottom: 16px">
		<div style="position: relative; max-width: 320px">
			<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.6 0.02 180)" stroke-width="2" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
			<input type="text" placeholder="ค้นหาเอกสาร..." bind:value={searchQuery}
				style="width: 100%; padding: 8px 14px 8px 36px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; outline: none; font-family: 'Noto Sans Thai', sans-serif" />
		</div>
	</div>

	<!-- V2 Documents (approved, waiting for procurement) -->
	{#if filteredV2.length > 0}
		<div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px">
			{#each filteredV2 as doc}
				{@const method = doc.procurement_method ?? ''}
				{@const sections = BILL_SECTION_LABELS[method] ?? {}}
				{@const sectionCount = Object.keys(sections).length}
				<a href="/procurement/{doc.slug ?? doc.id}" style="display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 14px; border: 1px solid oklch(0.92 0.005 180); background: white; text-decoration: none; transition: border-color 0.15s ease, box-shadow 0.15s ease"
					onmouseenter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.52 0.14 240 / 0.2)'; e.currentTarget.style.boxShadow = '0 4px 12px oklch(0.52 0.14 240 / 0.06)'; }}
					onmouseleave={(e) => { e.currentTarget.style.borderColor = 'oklch(0.92 0.005 180)'; e.currentTarget.style.boxShadow = 'none'; }}
				>
					<span style="font-size: 0.8125rem; font-weight: 700; color: oklch(0.4 0.04 240); min-width: 36px">#{doc.id}</span>
					<div style="flex: 1; min-width: 0">
						<span style="font-size: 0.875rem; font-weight: 600; color: oklch(0.2 0.02 180)">{doc.plan_title}</span>
						<div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap">
							<span style="padding: 1px 8px; border-radius: 5px; font-size: 0.625rem; font-weight: 600; background: oklch(0.52 0.14 240 / 0.06); color: oklch(0.42 0.14 240)">{docTypeLabels[doc.doc_type] ?? doc.doc_type}</span>
							{#if method}
								<span style="padding: 1px 8px; border-radius: 5px; font-size: 0.625rem; font-weight: 600; background: oklch(0.54 0.16 150 / 0.06); color: oklch(0.38 0.14 150)">{methodLabels[method] ?? method}</span>
							{/if}
							<span style="padding: 1px 8px; border-radius: 5px; font-size: 0.625rem; font-weight: 600; background: oklch(0.48 0.14 60 / 0.06); color: oklch(0.48 0.14 60)">{sectionCount} รายการเอกสาร</span>
						</div>
					</div>
					<span style="padding: 4px 12px; border-radius: 8px; font-size: 0.6875rem; font-weight: 600; background: oklch(0.62 0.18 60 / 0.08); color: oklch(0.48 0.14 60); white-space: nowrap">รอดำเนินการ</span>
					<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.7 0.02 180)" stroke-width="2" style="width: 16px; height: 16px; flex-shrink: 0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
				</a>
			{/each}
		</div>
	{:else}
		<div style="text-align: center; padding: 48px 24px; background: oklch(0.98 0.005 180); border: 1px solid oklch(0.92 0.005 180); border-radius: 14px; margin-bottom: 24px">
			{#if !data.selectedAgencyId && data.user.is_super_admin}
				<p style="margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180)">กรุณาเลือกจังหวัดและหน่วยงานก่อน</p>
			{:else}
				<p style="margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180)">ยังไม่มีเอกสารที่รอดำเนินการ</p>
				<p style="margin: 4px 0 0; font-size: 0.75rem; color: oklch(0.6 0.02 180)">เอกสารจะแสดงที่นี่เมื่อผ่านการอนุมัติจากหน้า "เอกสารจัดซื้อจัดจ้าง" แล้ว</p>
			{/if}
		</div>
	{/if}

	<!-- Legacy Documents (toggle) -->
	{#if legacyDocs.length > 0}
		<button onclick={() => (showLegacy = !showLegacy)}
			style="display: flex; align-items: center; gap: 6px; padding: 6px 14px; border: 1px solid oklch(0.88 0.01 180); border-radius: 8px; background: white; font-size: 0.6875rem; font-weight: 500; color: oklch(0.5 0.02 180); cursor: pointer; font-family: 'Noto Sans Thai', sans-serif; margin-bottom: 12px">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; transform: rotate({showLegacy ? '180' : '0'}deg); transition: transform 0.2s ease"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
			เอกสารจากระบบเดิม ({legacyDocs.length})
		</button>
		{#if showLegacy}
			<div style="display: flex; flex-direction: column; gap: 4px">
				{#each filteredLegacy as doc}
					<a href="/procurement/{doc.slug ?? doc.id}" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; border: 1px solid oklch(0.92 0.005 180); background: oklch(0.99 0.002 180); text-decoration: none; font-size: 0.8125rem"
						onmouseenter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.85 0.02 180)'; }}
						onmouseleave={(e) => { e.currentTarget.style.borderColor = 'oklch(0.92 0.005 180)'; }}
					>
						<span style="font-weight: 600; color: oklch(0.4 0.04 240); min-width: 30px">#{doc.id}</span>
						<span style="flex: 1; color: oklch(0.35 0.02 180); overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{doc.workflow_name ?? 'N/A'} — {doc.plan_title}</span>
						<StatusBadge status={doc.status} />
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
