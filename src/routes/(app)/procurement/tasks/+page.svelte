<script lang="ts">
	import BackButton from '$lib/components/BackButton.svelte';
	import { BILL_SECTION_LABELS } from '$lib/types/procurement';

	let { data } = $props();

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

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return '';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'เมื่อสักครู่';
		if (mins < 60) return `${mins} นาทีที่แล้ว`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours} ชม.ที่แล้ว`;
		const days = Math.floor(hours / 24);
		return `${days} วันที่แล้ว`;
	}

	function getSectionCount(method: string): number {
		return Object.keys(BILL_SECTION_LABELS[method] ?? {}).length;
	}

	function getFilledCount(method: string, payload: any): number {
		if (!payload || typeof payload !== 'object') return 0;
		const sections = Object.keys(BILL_SECTION_LABELS[method] ?? {});
		return sections.filter(k => {
			const v = payload[k];
			if (!v || typeof v !== 'object') return false;
			return Object.values(v).some(val => val !== null && val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0));
		}).length;
	}

	let totalV2 = $derived(data.v2Tasks.length);
	let totalLegacy = $derived(data.tasks.length);

	// Legacy grouping
	const legacyTypeLabels: Record<string, { label: string; action: string; color: string; bg: string; icon: string }> = {
		APPROVER: { label: 'รออนุมัติ', action: 'ตรวจสอบและอนุมัติ', color: 'oklch(0.48 0.14 60)', bg: 'oklch(0.62 0.18 60 / 0.08)', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
		UPLOADER: { label: 'รอส่งเอกสาร', action: 'อัปโหลดเอกสาร', color: 'oklch(0.42 0.12 240)', bg: 'oklch(0.52 0.14 240 / 0.08)', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
		COMMITTEE_MEMBER: { label: 'รอแต่งตั้งกรรมการ', action: 'ดำเนินการ', color: 'oklch(0.45 0.1 280)', bg: 'oklch(0.55 0.12 280 / 0.08)', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857' },
		SCORER: { label: 'รอให้คะแนน', action: 'ให้คะแนน', color: 'oklch(0.4 0.14 150)', bg: 'oklch(0.54 0.16 150 / 0.08)', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888' }
	};
	const legacyGroupOrder = ['APPROVER', 'UPLOADER', 'COMMITTEE_MEMBER', 'SCORER'] as const;
	let activeLegacyGroups = $derived(legacyGroupOrder.filter((g) => (data.grouped as any)[g]?.length > 0));
</script>

<div>
	<BackButton href="/procurement" label="กลับหน้าจัดซื้อจัดจ้าง" />

	<div style="display: flex; justify-content: space-between; align-items: flex-start; margin: 20px 0 24px; gap: 16px">
		<div>
			<h1 style="margin: 0 0 4px; font-size: clamp(1.375rem, 1.1rem + 0.7vw, 1.625rem); font-weight: 700; color: oklch(0.2 0.02 180)">งานจัดซื้อจัดจ้าง</h1>
			<p style="margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180)">
				เอกสารที่รอให้ฝ่ายจัดซื้อใส่ข้อมูลและส่งการเงิน
				<span style="padding: 2px 10px; border-radius: 6px; background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.14 240); font-size: 0.75rem; font-weight: 600; margin-left: 8px">{totalV2 + totalLegacy} งาน</span>
			</p>
		</div>
	</div>

	<!-- ═══ V2: Consolidated Bill Tasks ═══ -->
	{#if totalV2 > 0}
		<section style="margin-bottom: 32px">
			<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding: 0 4px">
				<div style="width: 32px; height: 32px; border-radius: 8px; background: oklch(0.52 0.14 240 / 0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0">
					<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.42 0.14 240)" stroke-width="1.75" style="width: 18px; height: 18px"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
				</div>
				<h2 style="margin: 0; font-size: 1rem; font-weight: 600; color: oklch(0.2 0.02 180); flex: 1">รอจัดทำเอกสาร</h2>
				<span style="padding: 2px 8px; border-radius: 6px; font-size: 0.6875rem; font-weight: 700; background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.14 240)">{totalV2}</span>
			</div>

			<div style="display: flex; flex-direction: column; gap: 10px">
				{#each data.v2Tasks as task}
					{@const method = task.procurement_method ?? ''}
					{@const sections = BILL_SECTION_LABELS[method] ?? {}}
					{@const sectionCount = Object.keys(sections).length}
					{@const filledCount = getFilledCount(method, task.bill_payload)}
					{@const isDraft = filledCount > 0}

					<a href="/procurement/{task.document_slug ?? task.document_id}" style="display: flex; gap: 16px; padding: 18px 22px; border-radius: 14px; border: 1px solid oklch(0.92 0.005 180); background: oklch(0.995 0.002 180); text-decoration: none; transition: box-shadow 0.15s ease, border-color 0.15s ease; align-items: flex-start"
						onmouseenter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px oklch(0.52 0.14 240 / 0.08)'; e.currentTarget.style.borderColor = 'oklch(0.52 0.14 240 / 0.2)'; }}
						onmouseleave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'oklch(0.92 0.005 180)'; }}
					>
						<!-- Status indicator -->
						<div style="width: 40px; height: 40px; border-radius: 10px; background: {isDraft ? 'oklch(0.62 0.18 60 / 0.08)' : 'oklch(0.52 0.14 240 / 0.08)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">
							{#if isDraft}
								<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.48 0.14 60)" stroke-width="1.75" style="width: 20px; height: 20px"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.42 0.14 240)" stroke-width="1.75" style="width: 20px; height: 20px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
							{/if}
						</div>

						<!-- Content -->
						<div style="flex: 1; min-width: 0">
							<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
								<h3 style="margin: 0; font-size: 0.9375rem; font-weight: 600; color: oklch(0.2 0.02 180)">#{task.document_id} — {task.plan_title}</h3>
							</div>

							<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px">
								<span style="padding: 2px 8px; border-radius: 5px; font-size: 0.625rem; font-weight: 600; background: oklch(0.52 0.14 240 / 0.06); color: oklch(0.42 0.14 240)">{docTypeLabels[task.doc_type] ?? task.doc_type}</span>
								{#if method}
									<span style="padding: 2px 8px; border-radius: 5px; font-size: 0.625rem; font-weight: 600; background: oklch(0.54 0.16 150 / 0.06); color: oklch(0.38 0.14 150)">{methodLabels[method] ?? method}</span>
								{/if}
								{#if task.round_number > 1}
									<span style="padding: 2px 8px; border-radius: 5px; font-size: 0.625rem; font-weight: 600; background: oklch(0.48 0.14 60 / 0.06); color: oklch(0.48 0.14 60)">รอบที่ {task.round_number}</span>
								{/if}
							</div>

							<!-- Section checklist preview -->
							{#if sectionCount > 0}
								<div style="display: flex; flex-wrap: wrap; gap: 4px">
									{#each Object.entries(sections) as [sKey, sLabel]}
										{@const isFilled = task.bill_payload && task.bill_payload[sKey] && Object.values(task.bill_payload[sKey]).some((v) => v !== null && v !== undefined && v !== '')}
										<span style="padding: 2px 8px; border-radius: 4px; font-size: 0.5625rem; font-weight: 500; background: {isFilled ? 'oklch(0.54 0.16 150 / 0.08)' : 'oklch(0.95 0.01 180)'}; color: {isFilled ? 'oklch(0.38 0.14 150)' : 'oklch(0.6 0.02 180)'}">
											{#if isFilled}✓{/if} {sLabel}
										</span>
									{/each}
								</div>
							{/if}

							<div style="margin-top: 6px; display: flex; align-items: center; gap: 8px">
								<!-- Progress bar -->
								<div style="width: 80px; height: 4px; border-radius: 2px; background: oklch(0.92 0.005 180); overflow: hidden">
									<div style="width: {sectionCount > 0 ? (filledCount / sectionCount * 100) : 0}%; height: 100%; border-radius: 2px; background: oklch(0.54 0.16 150); transition: width 0.3s ease"></div>
								</div>
								<span style="font-size: 0.625rem; color: oklch(0.55 0.02 180)">{filledCount}/{sectionCount} ส่วน</span>
								<span style="font-size: 0.625rem; color: oklch(0.65 0.01 180)">{timeAgo(task.created_at)}</span>
							</div>
						</div>

						<!-- Arrow -->
						<div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; align-self: center">
							<span style="font-size: 0.75rem; font-weight: 500; color: oklch(0.52 0.14 240)">{isDraft ? 'แก้ไขต่อ' : 'เริ่มกรอก'}</span>
							<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.52 0.14 240)" stroke-width="2" style="width: 14px; height: 14px"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ═══ Empty State (when no tasks at all) ═══ -->
	{#if totalV2 === 0 && totalLegacy === 0}
		<div style="text-align: center; padding: 64px 24px; background: oklch(0.98 0.005 180); border: 1px solid oklch(0.92 0.005 180); border-radius: 18px">
			<div style="width: 56px; height: 56px; margin: 0 auto 16px; color: oklch(0.54 0.16 150)">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 100%; height: 100%"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
			</div>
			<h3 style="margin: 0 0 4px; font-size: 1.125rem; font-weight: 600; color: oklch(0.3 0.02 180)">ไม่มีงานในขณะนี้</h3>
			<p style="margin: 0; font-size: 0.875rem; color: oklch(0.55 0.02 180)">ไม่มีเอกสารจัดซื้อจัดจ้างที่ต้องดำเนินการตอนนี้</p>
		</div>
	{/if}

	<!-- ═══ Legacy Tasks (old workflow) ═══ -->
	{#if totalLegacy > 0}
		<section style="margin-top: 8px">
			<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 0 4px">
				<h2 style="margin: 0; font-size: 0.875rem; font-weight: 600; color: oklch(0.5 0.02 180)">งานจากระบบเดิม ({totalLegacy})</h2>
			</div>
			{#each activeLegacyGroups as groupKey}
				{@const groupTasks = (data.grouped as any)[groupKey]}
				{@const info = legacyTypeLabels[groupKey]}
				<div style="margin-bottom: 20px">
					<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 0 4px">
						<div style="width: 24px; height: 24px; border-radius: 6px; background: {info.bg}; display: flex; align-items: center; justify-content: center">
							<svg viewBox="0 0 24 24" fill="none" stroke={info.color} stroke-width="1.75" style="width: 13px; height: 13px"><path stroke-linecap="round" stroke-linejoin="round" d={info.icon} /></svg>
						</div>
						<span style="font-size: 0.8125rem; font-weight: 600; color: oklch(0.35 0.02 180)">{info.label}</span>
						<span style="padding: 1px 7px; border-radius: 5px; font-size: 0.625rem; font-weight: 700; background: {info.bg}; color: {info.color}">{groupTasks.length}</span>
					</div>
					<div style="display: flex; flex-direction: column; gap: 6px">
						{#each groupTasks as task}
							<a href="/procurement/{task.document_slug ?? task.document_id}" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 1px solid oklch(0.92 0.005 180); background: oklch(0.995 0.002 180); text-decoration: none; transition: border-color 0.15s ease"
								onmouseenter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.52 0.14 240 / 0.2)'; }}
								onmouseleave={(e) => { e.currentTarget.style.borderColor = 'oklch(0.92 0.005 180)'; }}
							>
								<span style="padding: 3px 8px; border-radius: 6px; font-size: 0.625rem; font-weight: 700; white-space: nowrap; background: {info.bg}; color: {info.color}">ขั้นที่ {task.step_sequence}</span>
								<div style="flex: 1; min-width: 0">
									<span style="font-size: 0.8125rem; font-weight: 500; color: oklch(0.25 0.02 180)">{task.step_name}</span>
									<span style="margin-left: 6px; font-size: 0.6875rem; color: oklch(0.55 0.02 180)">{timeAgo(task.created_at)}</span>
								</div>
								<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.7 0.02 180)" stroke-width="2" style="width: 14px; height: 14px; flex-shrink: 0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</section>
	{/if}
</div>
