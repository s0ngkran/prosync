<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ScopeSelector from '$lib/components/ScopeSelector.svelte';
	import { formatBaht } from '$lib/utils/format';
	import { watchFormResult } from '$lib/stores/toast.svelte';

	let { data, form: formResult } = $props();
	watchFormResult(() => formResult);

	let showCreateModal = $state(false);
	let selectedDocType = $state('');
	let selectedProcMethod = $state('');
	let activeTab = $state<'tasks' | 'all'>('tasks');
	let searchQuery = $state('');

	const procMethodOptions = [
		{ value: 'specific_lte100k', label: 'วิธีเฉพาะเจาะจง (ไม่เกิน 100,000 บาท)' },
		{ value: 'specific_gt100k', label: 'วิธีเฉพาะเจาะจง (เกิน 100,000 บาท)' },
		{ value: 'selection', label: 'วิธีคัดเลือก' },
		{ value: 'e_bidding', label: 'วิธีประกวดราคาอิเล็กทรอนิกส์ (e-Bidding)' },
		{ value: 'e_market', label: 'วิธีตลาดอิเล็กทรอนิกส์ (e-Market)' }
	];

	let needsProcMethod = $derived(['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel'].includes(selectedDocType));

	const docTypeOptions = [
		{ value: 'type1_nParcel', label: 'ซื้อครั้งเดียว จ่ายครั้งเดียว', desc: 'เช่น ซื้อเครื่องฟอกอากาศ' },
		{ value: 'type2_iParcelUtil', label: 'ค่าสาธารณูปโภค', desc: 'จ่ายหลายรอบ ผ่านจัดซื้อ ไม่ผ่าน ผอ.' },
		{ value: 'type3_iParcel', label: 'ค่าซ่อมแซมบำรุง', desc: 'จ่ายหลายรอบ ผ่านจัดซื้อ ผ่าน ผอ.' },
		{ value: 'type4_iFinance', label: 'ค่าตอบแทน (ตรงการเงิน)', desc: 'ไม่ผ่านจัดซื้อ ไปการเงินเลย' },
		{ value: 'type5_project', label: 'โครงการ', desc: 'มีเอกสารย่อยหลายรายการ' }
	];

	const docTypeLabels: Record<string, string> = {
		type1_nParcel: 'ซื้อครั้งเดียว',
		type2_iParcelUtil: 'สาธารณูปโภค',
		type3_iParcel: 'ซ่อมบำรุง',
		type4_iFinance: 'ค่าตอบแทน',
		type5_project: 'โครงการ'
	};

	const stepRoleLabels: Record<string, { label: string; color: string; bg: string }> = {
		DIVISION_DRAFT: { label: 'รอร่างเอกสาร', color: 'oklch(0.42 0.12 240)', bg: 'oklch(0.52 0.14 240 / 0.08)' },
		HEAD_APPROVE: { label: 'รออนุมัติจากหัวหน้า', color: 'oklch(0.48 0.14 60)', bg: 'oklch(0.62 0.18 60 / 0.08)' },
		PLANNER_CHECK: { label: 'รอแผนงานตรวจสอบ', color: 'oklch(0.45 0.1 280)', bg: 'oklch(0.55 0.12 280 / 0.08)' },
		PLANNER_DIRECTOR_APPROVE: { label: 'รอหัวหน้าแผนงาน', color: 'oklch(0.42 0.14 200)', bg: 'oklch(0.52 0.14 200 / 0.08)' },
		DIRECTOR_APPROVE: { label: 'รอ ผอ. อนุมัติ', color: 'oklch(0.4 0.14 150)', bg: 'oklch(0.54 0.16 150 / 0.08)' }
	};

	const phaseLabels: Record<string, string> = {
		APPROVAL: 'อนุมัติ',
		EXECUTION: 'ดำเนินการ',
		COMPLETED: 'เสร็จสิ้น'
	};

	// Group pending tasks by step code
	let taskGroups = $derived(() => {
		const groups: Record<string, any[]> = {};
		for (const task of data.pendingTasks) {
			if (!groups[task.step_code]) groups[task.step_code] = [];
			groups[task.step_code].push(task);
		}
		return groups;
	});

	let activeGroupKeys = $derived(Object.keys(taskGroups()).filter(k => taskGroups()[k].length > 0));

	let filteredDocs = $derived(
		data.documents.filter((d: any) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return d.plan_title?.toLowerCase().includes(q) || String(d.id).includes(q);
		})
	);

	function timeAgo(dateStr: string | null) {
		if (!dateStr) return '';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'เมื่อสักครู่';
		if (mins < 60) return `${mins} นาทีที่แล้ว`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
		const days = Math.floor(hrs / 24);
		return `${days} วันที่แล้ว`;
	}

	let canCreate = $derived(data.user.is_super_admin || data.user.is_director || data.user.permissions?.can_manage_procurement || true);
</script>

<div>
	<div class="flex items-start justify-between" style="margin: 20px 0 24px">
		<div>
			<h1 style="margin: 0 0 4px; font-size: clamp(1.375rem, 1.1rem + 0.7vw, 1.625rem); font-weight: 700; color: oklch(0.2 0.02 180)">เอกสารจัดซื้อจัดจ้าง</h1>
			<p style="margin: 0; font-size: 0.875rem; color: oklch(0.5 0.02 180)">สร้างเอกสาร ส่งอนุมัติ และติดตามสถานะ</p>
		</div>
		{#if canCreate}
			<button onclick={() => (showCreateModal = true)} style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 10px; border: none; background: oklch(0.52 0.14 240); color: oklch(0.98 0.005 180); font-size: 0.875rem; font-weight: 500; cursor: pointer">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
				สร้างเอกสาร
			</button>
		{/if}
	</div>

	{#if data.user.is_super_admin}
		<ScopeSelector />
	{/if}

	<!-- Tabs -->
	<div style="display: flex; gap: 2px; margin-bottom: 16px">
		<button
			onclick={() => (activeTab = 'tasks')}
			style="padding: 8px 18px; border: none; border-radius: 8px; font-family: 'Noto Sans Thai', sans-serif; font-size: 0.8125rem; font-weight: {activeTab === 'tasks' ? '600' : '500'}; cursor: pointer; background: {activeTab === 'tasks' ? 'oklch(0.52 0.14 240 / 0.08)' : 'transparent'}; color: {activeTab === 'tasks' ? 'oklch(0.42 0.14 240)' : 'oklch(0.5 0.02 180)'}"
		>
			งานของฉัน
			{#if data.pendingTasks.length > 0}
				<span style="margin-left: 6px; padding: 1px 8px; border-radius: 10px; font-size: 0.6875rem; font-weight: 600; background: oklch(0.52 0.14 240 / 0.12); color: oklch(0.42 0.14 240)">{data.pendingTasks.length}</span>
			{/if}
		</button>
		<button
			onclick={() => (activeTab = 'all')}
			style="padding: 8px 18px; border: none; border-radius: 8px; font-family: 'Noto Sans Thai', sans-serif; font-size: 0.8125rem; font-weight: {activeTab === 'all' ? '600' : '500'}; cursor: pointer; background: {activeTab === 'all' ? 'oklch(0.52 0.14 240 / 0.08)' : 'transparent'}; color: {activeTab === 'all' ? 'oklch(0.42 0.14 240)' : 'oklch(0.5 0.02 180)'}"
		>
			เอกสารทั้งหมด ({data.documents.length})
		</button>
	</div>

	<!-- Tasks Tab -->
	{#if activeTab === 'tasks'}
		{#if data.pendingTasks.length === 0}
			<div style="text-align: center; padding: 48px 20px">
				<div style="width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 50%; background: oklch(0.54 0.16 150 / 0.08); display: flex; align-items: center; justify-content: center">
					<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.54 0.16 150)" stroke-width="2" style="width: 24px; height: 24px"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				</div>
				<h3 style="margin: 0 0 4px; font-size: 1rem; font-weight: 600; color: oklch(0.3 0.02 180)">ไม่มีงานในขณะนี้</h3>
				<p style="margin: 0; font-size: 0.8125rem; color: oklch(0.55 0.02 180)">คุณไม่มีเอกสารที่ต้องดำเนินการ</p>
			</div>
		{:else}
			{#each activeGroupKeys as groupKey}
				{@const tasks = taskGroups()[groupKey]}
				{@const info = stepRoleLabels[groupKey] ?? { label: groupKey, color: 'oklch(0.5 0.02 180)', bg: 'oklch(0.95 0.01 180)' }}
				<section style="margin-bottom: 24px">
					<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
						<h2 style="margin: 0; font-size: 0.9375rem; font-weight: 600; color: {info.color}">{info.label}</h2>
						<span style="padding: 1px 10px; border-radius: 10px; font-size: 0.6875rem; font-weight: 600; background: {info.bg}; color: {info.color}">{tasks.length}</span>
					</div>
					<div style="display: flex; flex-direction: column; gap: 8px">
						{#each tasks as task}
							<a href="/documents/{task.document_slug}" style="display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 14px; border: 1px solid oklch(0.92 0.005 180); background: oklch(0.995 0.002 180); text-decoration: none; transition: box-shadow 0.15s ease, border-color 0.15s ease"
								onmouseenter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px oklch(0.52 0.14 240 / 0.08)'; e.currentTarget.style.borderColor = 'oklch(0.52 0.14 240 / 0.2)'; }}
								onmouseleave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'oklch(0.92 0.005 180)'; }}
							>
								<div style="padding: 6px 12px; border-radius: 8px; font-size: 0.6875rem; font-weight: 600; white-space: nowrap; background: {info.bg}; color: {info.color}">
									ขั้นที่ {task.step_sequence}
								</div>
								<div style="flex: 1; min-width: 0">
									<h3 style="margin: 0; font-size: 0.875rem; font-weight: 600; color: oklch(0.25 0.02 180)">{task.step_name}</h3>
									<p style="margin: 2px 0 0; font-size: 0.75rem; color: oklch(0.55 0.02 180); overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
										#{task.document_id} — {task.plan_title}
										{#if task.doc_type}
											<span style="margin-left: 4px; color: oklch(0.45 0.08 240)">({docTypeLabels[task.doc_type] ?? task.doc_type})</span>
										{/if}
									</p>
									<span style="font-size: 0.6875rem; color: oklch(0.6 0.02 180)">{timeAgo(task.created_at)}</span>
								</div>
								<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.7 0.02 180)" stroke-width="2" style="width: 18px; height: 18px; flex-shrink: 0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
							</a>
						{/each}
					</div>
				</section>
			{/each}
		{/if}
	{/if}

	<!-- All Documents Tab -->
	{#if activeTab === 'all'}
		<div style="margin-bottom: 12px">
			<input
				type="text"
				placeholder="ค้นหาเอกสาร..."
				bind:value={searchQuery}
				style="width: 100%; max-width: 320px; padding: 8px 14px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; outline: none; font-family: 'Noto Sans Thai', sans-serif"
			/>
		</div>
		<div style="display: flex; flex-direction: column; gap: 6px">
			{#each filteredDocs as doc}
				<a href="/documents/{doc.slug}" style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 12px; border: 1px solid oklch(0.92 0.005 180); background: white; text-decoration: none; transition: border-color 0.15s ease"
					onmouseenter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.52 0.14 240 / 0.2)'; }}
					onmouseleave={(e) => { e.currentTarget.style.borderColor = 'oklch(0.92 0.005 180)'; }}
				>
					<span style="font-size: 0.8125rem; font-weight: 600; color: oklch(0.4 0.04 240); min-width: 36px">#{doc.id}</span>
					<div style="flex: 1; min-width: 0">
						<span style="font-size: 0.8125rem; font-weight: 500; color: oklch(0.25 0.02 180)">{doc.plan_title}</span>
						{#if doc.doc_type}
							<span style="margin-left: 6px; font-size: 0.6875rem; padding: 1px 8px; border-radius: 6px; background: oklch(0.95 0.01 180); color: oklch(0.5 0.02 180)">{docTypeLabels[doc.doc_type] ?? doc.doc_type}</span>
						{/if}
					</div>
					<span style="font-size: 0.6875rem; padding: 2px 10px; border-radius: 6px; font-weight: 500; background: {doc.phase === 'APPROVAL' ? 'oklch(0.62 0.18 60 / 0.08)' : doc.phase === 'EXECUTION' ? 'oklch(0.52 0.14 240 / 0.08)' : 'oklch(0.54 0.16 150 / 0.08)'}; color: {doc.phase === 'APPROVAL' ? 'oklch(0.48 0.14 60)' : doc.phase === 'EXECUTION' ? 'oklch(0.42 0.14 240)' : 'oklch(0.38 0.14 150)'}">{phaseLabels[doc.phase] ?? doc.phase}</span>
					<StatusBadge status={doc.status} />
				</a>
			{/each}
			{#if filteredDocs.length === 0}
				<p style="text-align: center; padding: 32px; font-size: 0.8125rem; color: oklch(0.55 0.02 180)">ไม่พบเอกสาร</p>
			{/if}
		</div>
	{/if}
</div>

<!-- Create Document Modal -->
{#if showCreateModal}
	<div style="position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px)" onclick={() => (showCreateModal = false)}>
		<div style="background: white; border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 48px oklch(0.15 0.02 180 / 0.2)" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 24px 24px 0">
				<h2 style="margin: 0; font-size: 1.125rem; font-weight: 700; color: oklch(0.2 0.02 180)">สร้างเอกสารจัดซื้อจัดจ้าง</h2>
			</div>
			<form method="POST" action="?/createDocument" use:enhance={() => {
				return async ({ update, result }) => { if (result.type === 'success') { showCreateModal = false; selectedDocType = ''; selectedProcMethod = ''; } await update(); };
			}}>
				<input type="hidden" name="agency_id" value={data.selectedAgencyId || ''} />
				<div style="padding: 16px 24px">
					<!-- Document Type -->
					<label style="display: block; margin-bottom: 4px; font-size: 0.8125rem; font-weight: 600; color: oklch(0.35 0.02 180)">ประเภทเอกสาร <span style="color: oklch(0.58 0.2 25)">*</span></label>
					<div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px">
						{#each docTypeOptions as opt}
							<label
								style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 10px; cursor: pointer; border: 1.5px solid {selectedDocType === opt.value ? 'oklch(0.52 0.14 240)' : 'oklch(0.9 0.01 180)'}; background: {selectedDocType === opt.value ? 'oklch(0.52 0.14 240 / 0.04)' : 'white'}; transition: border-color 0.15s ease"
							>
								<input type="radio" name="doc_type" value={opt.value} required style="margin-top: 2px"
									onchange={() => { selectedDocType = opt.value; }} />
								<div>
									<span style="font-size: 0.8125rem; font-weight: 600; color: oklch(0.25 0.02 180)">{opt.label}</span>
									<p style="margin: 2px 0 0; font-size: 0.6875rem; color: oklch(0.55 0.02 180)">{opt.desc}</p>
								</div>
							</label>
						{/each}
					</div>

					<!-- Procurement Method (for type1/2/3) -->
					{#if needsProcMethod}
						<div style="margin-bottom: 16px">
							<label style="display: block; margin-bottom: 4px; font-size: 0.8125rem; font-weight: 600; color: oklch(0.35 0.02 180)">วิธีจัดซื้อจัดจ้าง <span style="color: oklch(0.58 0.2 25)">*</span></label>
							<CustomSelect
								name="procurement_method"
								required
								placeholder="-- เลือกวิธีจัดซื้อ --"
								options={procMethodOptions}
								onchange={(v) => { selectedProcMethod = v; }}
							/>
						</div>
					{/if}

					<!-- Plan Selection -->
					<label style="display: block; margin-bottom: 4px; font-size: 0.8125rem; font-weight: 600; color: oklch(0.35 0.02 180)">แผนงาน (Leaf Node) <span style="color: oklch(0.58 0.2 25)">*</span></label>
					<CustomSelect
						name="plan_id"
						required
						placeholder="-- เลือกแผนงาน --"
						options={data.leafPlans.map((p: any) => ({ value: String(p.id), label: `[ปี ${p.fiscal_year}] ${p.title} (${formatBaht(p.estimated_amount)})` }))}
					/>

					<!-- Flow Preview -->
					{#if selectedDocType}
						<div style="margin-top: 16px; padding: 12px; border-radius: 10px; background: oklch(0.97 0.005 180); border: 1px solid oklch(0.92 0.005 180)">
							<p style="margin: 0 0 8px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: oklch(0.5 0.02 180)">ขั้นตอนอนุมัติ</p>
							<div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; color: oklch(0.4 0.02 180)">
								<div>1. แผนกรับผิดชอบ — ร่างเอกสาร</div>
								<div>2. หัวหน้าแผนก — อนุมัติ</div>
								<div>3. แผนกแผนงาน — ตรวจสอบ</div>
								<div>4. หัวหน้าแผนงาน — เสนอ ผอ.</div>
								<div>5. ผอ. — อนุมัติ</div>
								<div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed oklch(0.88 0.01 180); color: oklch(0.5 0.06 240)">
									{#if ['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel'].includes(selectedDocType)}
										→ ส่งไปแผนกจัดซื้อจัดจ้าง
									{:else if selectedDocType === 'type4_iFinance'}
										→ ส่งไปแผนกการเงินโดยตรง
									{:else}
										→ จัดการเอกสารย่อยในโครงการ
									{/if}
								</div>
							</div>
						</div>
					{/if}
				</div>
				<div style="padding: 16px 24px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid oklch(0.94 0.005 180)">
					<button type="button" onclick={() => { showCreateModal = false; selectedDocType = ''; }} style="padding: 8px 16px; border-radius: 10px; border: none; background: none; color: oklch(0.45 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer">ยกเลิก</button>
					<button type="submit" disabled={!selectedDocType} style="padding: 8px 18px; border-radius: 10px; border: none; background: oklch(0.52 0.14 240); color: white; font-size: 0.875rem; font-weight: 500; cursor: pointer; opacity: {selectedDocType ? '1' : '0.5'}">สร้างเอกสาร</button>
				</div>
			</form>
		</div>
	</div>
{/if}
