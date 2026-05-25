<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { formatBaht, downloadCsvTemplate } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import CustomDatePicker from '$lib/components/CustomDatePicker.svelte';
	import { showToast } from '$lib/stores/toast.svelte';

	let { data } = $props();
	let showCreateModal = $state(false);
	let showPlanImportModal = $state(false);
	let showFyModal = $state(false);
	let editingPlan = $state<any>(null);
	let creatingParentId = $state<number | null>(null);
	let createIsLeaf = $state(false);
	let editIsLeaf = $state(false);
	let viewingPlan = $state<any>(null);
	let deletingPlan = $state<any>(null);

	// Toast notifications handled by global Toast component

	// Collapse/expand state: track which plan IDs are collapsed
	let collapsed = $state<Set<number>>(new Set());
	function toggleCollapse(id: number) {
		const next = new Set(collapsed);
		if (next.has(id)) next.delete(id); else next.add(id);
		collapsed = next;
	}

	// Search & Filters
	let searchQuery = $state('');
	let filterPlanTypeStr = $state('');
	let filterResponsibleUnitStr = $state('');
	let filterStakeholderUnitStr = $state('');
	let filterBudgetMin = $state('');
	let filterBudgetMax = $state('');
	let filterPlanType = $derived(filterPlanTypeStr || null);
	let filterResponsibleUnit = $derived(filterResponsibleUnitStr ? Number(filterResponsibleUnitStr) : null);
	let filterStakeholderUnit = $derived(filterStakeholderUnitStr ? Number(filterStakeholderUnitStr) : null);

	let canCreate = $derived(!!data.selectedAgencyId && (data.user.is_super_admin || data.user.permissions.can_manage_plans));

	function getParentPlan(parentId: number | null) {
		if (!parentId) return null;
		return data.plans.find((p: any) => p.id === parentId) || null;
	}

	function getOrgUnitName(id: number | null) {
		if (!id) return null;
		return data.orgUnits.find((u: any) => u.id === id)?.name || null;
	}

	let parentPlan = $derived(getParentPlan(creatingParentId));
	let parentMinDate = $derived(parentPlan?.start_date || '');
	let parentMaxDate = $derived(parentPlan?.end_date || '');
	let isSubPlan = $derived(!!creatingParentId);

	function buildTree(planList: any[], parentId: number | null = null): any[] {
		return planList
			.filter((p) => p.parent_id === parentId)
			.map((p) => ({ ...p, children: buildTree(planList, p.id) }));
	}

	// Filter plans — when a child matches search, include the whole parent tree
	let filteredPlans = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		const rUnit = filterResponsibleUnit;
		const sUnit = filterStakeholderUnit;
		const bMin = filterBudgetMin ? Number(filterBudgetMin) : null;
		const bMax = filterBudgetMax ? Number(filterBudgetMax) : null;

		const pType = filterPlanType;
		const hasFilter = q || pType || rUnit || sUnit || bMin !== null || bMax !== null;
		if (!hasFilter) return data.plans;

		// Check if a single plan matches the non-search filters
		function matchesFilters(p: any): boolean {
			if (pType && p.plan_type !== pType) return false;
			if (rUnit && p.responsible_unit_id !== rUnit) return false;
			if (sUnit && !(Array.isArray(p.stakeholder_unit_ids) && p.stakeholder_unit_ids.includes(sUnit))) return false;
			const est = Number(p.estimated_amount);
			if (bMin !== null && est < bMin) return false;
			if (bMax !== null && est > bMax) return false;
			return true;
		}

		// Check if plan matches search query across all fields
		function matchesSearch(p: any): boolean {
			if (!q) return true;
			// Title
			if (p.title.toLowerCase().includes(q)) return true;
			// Budget amounts
			const estStr = Number(p.estimated_amount).toLocaleString();
			const actStr = Number(p.actual_amount).toLocaleString();
			if (String(p.estimated_amount).includes(q) || estStr.includes(q)) return true;
			if (String(p.actual_amount).includes(q) || actStr.includes(q)) return true;
			// Duration
			if (p.duration_text && p.duration_text.toLowerCase().includes(q)) return true;
			// Dates
			if (p.start_date && p.start_date.includes(q)) return true;
			if (p.end_date && p.end_date.includes(q)) return true;
			// Plan type
			const typeLabel = p.plan_type === 'INCOME' ? 'รายรับ' : 'รายจ่าย';
			if (typeLabel.includes(q)) return true;
			// Responsible unit name
			const unitName = getOrgUnitName(p.responsible_unit_id);
			if (unitName && unitName.toLowerCase().includes(q)) return true;
			// Description
			if (p.description && p.description.toLowerCase().includes(q)) return true;
			return false;
		}

		// Find all plan IDs that directly match
		const matchedIds = new Set<number>();
		for (const p of data.plans) {
			if (matchesFilters(p) && matchesSearch(p)) {
				matchedIds.add(p.id);
			}
		}

		// For each matched plan, walk up to include all ancestors
		const includedIds = new Set<number>(matchedIds);
		function addAncestors(planId: number) {
			const plan = data.plans.find((p: any) => p.id === planId);
			if (plan?.parent_id) {
				includedIds.add(plan.parent_id);
				addAncestors(plan.parent_id);
			}
		}
		for (const id of matchedIds) {
			addAncestors(id);
		}

		// For each matched plan, if it's a child, include all siblings under same parent
		// Also include all descendants of matched parents
		const finalIds = new Set<number>(includedIds);
		for (const id of matchedIds) {
			const plan = data.plans.find((p: any) => p.id === id);
			if (plan?.parent_id) {
				// Add all siblings under same parent
				for (const p of data.plans) {
					if (p.parent_id === plan.parent_id) {
						finalIds.add(p.id);
					}
				}
			}
		}
		// Include all descendants of included plans
		function addDescendants(parentId: number) {
			for (const p of data.plans) {
				if (p.parent_id === parentId && !finalIds.has(p.id)) {
					finalIds.add(p.id);
					addDescendants(p.id);
				}
			}
		}
		for (const id of Array.from(includedIds)) {
			addDescendants(id);
		}

		return data.plans.filter((p: any) => finalIds.has(p.id));
	});

	let tree = $derived(buildTree(filteredPlans));
	let activeFy = $derived(data.fiscalYears.find((fy: any) => fy.id === data.selectedFyId));

	// Auto-expand all when searching
	$effect(() => {
		if (searchQuery.trim() || filterPlanType || filterResponsibleUnit || filterStakeholderUnit || filterBudgetMin || filterBudgetMax) {
			collapsed = new Set();
		}
	});

	function selectFy(fyId: number) {
		const params = new URLSearchParams();
		if (data.selectedProvinceId) params.set('province_id', String(data.selectedProvinceId));
		if (data.selectedAgencyId) params.set('agency_id', String(data.selectedAgencyId));
		params.set('fy_id', String(fyId));
		goto(`/planning?${params.toString()}`);
	}

	function budgetProgress(estimated: string, actual: string): number {
		const est = Number(estimated);
		const act = Number(actual);
		if (est <= 0) return 0;
		return Math.min(100, Math.round((act / est) * 100));
	}

	function budgetRawPercent(estimated: string, actual: string): number {
		const est = Number(estimated);
		const act = Number(actual);
		if (est <= 0) return 0;
		return Math.round((act / est) * 100);
	}

	function budgetBarColor(planType: string, rawPercent: number): string {
		if (planType === 'INCOME') return 'var(--color-health-500)';
		// Expense: red if over 100%, blue otherwise
		return rawPercent > 100 ? 'var(--color-error)' : 'var(--color-brand-500)';
	}
</script>

<!-- Tree Node -->
{#snippet planNode(node: any, depth: number, isLast: boolean)}
	{@const progress = budgetProgress(node.estimated_amount, node.actual_amount)}
	{@const rawPercent = budgetRawPercent(node.estimated_amount, node.actual_amount)}
	{@const barColor = budgetBarColor(node.plan_type, rawPercent)}
	{@const hasChildren = node.children?.length > 0}
	<div class="relative" style="margin-left: {depth > 0 ? '2rem' : '0'}">
		{#if depth > 0}
			<div class="absolute -left-5 top-0 h-5 w-5 border-b-2 border-l-2 rounded-bl-lg"
				style="border-color: var(--color-slate-200)"></div>
			{#if !isLast}
				<div class="absolute -left-5 top-0 bottom-0 border-l-2" style="border-color: var(--color-slate-200)"></div>
			{/if}
		{/if}

		<div class="mb-1.5">
			<div class="flex items-stretch gap-0">
				<!-- Collapse toggle: outside the modal-opening div -->
				{#if hasChildren}
					<button class="shrink-0 flex items-center justify-center rounded-l-lg px-2 transition-colors duration-150"
						style="color: var(--color-slate-400)"
						title={collapsed.has(node.id) ? 'ขยาย' : 'ยุบ'}
						onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-slate-100)'}
						onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
						onclick={() => toggleCollapse(node.id)}>
						<svg class="h-4 w-4 transition-transform duration-200" style="transform: rotate({collapsed.has(node.id) ? '0deg' : '90deg'}); transition-timing-function: var(--ease-out-expo)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
					</button>
				{:else}
					<div class="w-8 shrink-0"></div>
				{/if}

				<!-- Card: opens detail modal -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div onclick={() => (viewingPlan = node)}
					class="group min-w-0 flex-1 cursor-pointer transition-all duration-300"
					style="transition-timing-function: var(--ease-out-expo)">
				<div class="flex items-center gap-3 rounded-lg px-3 py-2.5 hover-lift"
					style="background: {depth === 0 ? 'var(--color-slate-50)' : 'transparent'}">
					<!-- Left accent -->
					{#if depth === 0}
						<div class="w-1 self-stretch rounded-full"
							style="background: {node.plan_type === 'INCOME' ? 'var(--color-health-500)' : 'var(--color-brand-500)'}"></div>
					{/if}

					<!-- Content -->
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline gap-2">
							<span class="{depth === 0 ? 'text-sm font-semibold' : 'text-[0.8125rem] font-medium'} truncate"
								style="color: var(--color-slate-900)">{node.title}</span>
							<span class="shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase"
								style="background: {node.plan_type === 'INCOME' ? 'var(--color-health-100)' : 'var(--color-brand-100)'}; color: {node.plan_type === 'INCOME' ? 'var(--color-health-700)' : 'var(--color-brand-700)'}">
								{node.plan_type === 'INCOME' ? 'รายรับ' : 'รายจ่าย'}
							</span>
							{#if node.is_leaf_node}
								<span class="shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium"
									style="background: var(--color-info-muted); color: var(--color-brand-700)">พร้อมจัดซื้อ</span>
							{/if}
						</div>

						<!-- Budget row -->
						<div class="mt-1 flex items-center gap-3">
							<div class="flex-1">
								<div class="flex justify-between text-[0.6875rem]" style="color: var(--color-slate-500)">
									<span>{formatBaht(node.estimated_amount)}</span>
									<span>{formatBaht(node.actual_amount)}</span>
								</div>
								<div class="mt-0.5 h-1 w-full overflow-hidden rounded-full" style="background: var(--color-slate-200)">
									<div class="h-full rounded-full transition-all duration-500"
										style="width: {progress}%; background: {barColor}; transition-timing-function: var(--ease-out-expo)"></div>
								</div>
							</div>
							{#if Number(node.estimated_amount) > 0}
								<span class="shrink-0 text-[0.625rem] font-semibold tabular-nums" style="color: var(--color-slate-500)">{progress}%</span>
							{/if}
						</div>

						{#if node.start_date && node.end_date}
							<p class="mt-0.5 text-[0.6875rem]" style="color: var(--color-slate-400)">
								{node.start_date} — {node.end_date}
								{#if node.duration_text}<span style="color: var(--color-slate-300)"> / {node.duration_text}</span>{/if}
							</p>
						{/if}
					</div>

					<!-- Actions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					{#if canCreate}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
						onclick={(e) => e.stopPropagation()}>
						{#if !node.is_leaf_node}
							<button onclick={() => { creatingParentId = node.id; showCreateModal = true; }}
								class="rounded-md p-1.5 transition-colors duration-150" title="เพิ่มแผนย่อย"
								style="color: var(--color-health-600)" onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-health-50)'} onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
							</button>
						{/if}
						<button onclick={() => { editingPlan = node; editIsLeaf = node.is_leaf_node; }}
							class="rounded-md p-1.5 transition-colors duration-150" title="แก้ไข"
							style="color: var(--color-brand-600)" onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-50)'} onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
						</button>
						<button class="rounded-md p-1.5 transition-colors duration-150" title="ลบ"
							style="color: var(--color-error)"
							onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-error-muted)'}
							onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
							onclick={(e) => { e.stopPropagation(); deletingPlan = node; }}>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
						</button>
					</div>
					{/if}
				</div>
			</div>
			</div>

			{#if hasChildren && !collapsed.has(node.id)}
				<div class="relative pl-3">
					{#each node.children as child, i}
						{@render planNode(child, depth + 1, i === node.children.length - 1)}
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<div>
	<PageHeader title="แผนยุทธศาสตร์" subtitle="จัดการแผนงาน งบประมาณ และติดตามผลการดำเนินงาน" compact />

	<!-- Compact Header -->
	<div class="shrink-0">
		<!-- Row 1: Agency selector + FY tabs + Actions — all in one line -->
		<div class="flex items-center gap-4">

			{#if data.user.is_super_admin}
				<CustomSelect
					value={data.selectedProvinceId ? String(data.selectedProvinceId) : ''}
					options={data.provinces.map((p) => ({ value: String(p.id), label: p.name }))}
					placeholder="-- จังหวัด --"
					onchange={async (v) => {
						const form = new FormData();
						form.set('province_id', v || '');
						form.set('agency_id', '');
						await fetch('/org-management?/selectScope', { method: 'POST', body: form });
						location.reload();
					}}
					class="shrink-0 max-w-[10rem]"
				/>
				<CustomSelect
					value={data.selectedAgencyId ? String(data.selectedAgencyId) : ''}
					options={data.agencies.map((a) => ({ value: String(a.id), label: a.name }))}
					placeholder={data.selectedProvinceId && data.agencies.length === 0 ? '-- ไม่มีหน่วยงาน --' : '-- หน่วยงาน --'}
					disabled={!data.selectedProvinceId}
					onchange={async (v) => {
						if (!v) return;
						const form = new FormData();
						form.set('province_id', String(data.selectedProvinceId || ''));
						form.set('agency_id', v);
						await fetch('/org-management?/selectScope', { method: 'POST', body: form });
						location.reload();
					}}
					class="shrink-0 max-w-[12rem]"
				/>
			{/if}

			{#if data.fiscalYears.length > 0}
				<div class="flex items-center gap-0.5">
					{#each data.fiscalYears as fy}
						<button onclick={() => selectFy(fy.id)}
							class="relative rounded-md px-2.5 py-1 text-[0.75rem] font-medium transition-colors duration-200"
							style="color: {data.selectedFyId === fy.id ? 'var(--color-brand-700)' : 'var(--color-slate-500)'}; background: {data.selectedFyId === fy.id ? 'var(--color-brand-50)' : 'transparent'}">
							{fy.year_name}
							{#if fy.is_active}
								<span class="ml-0.5 inline-block h-1.5 w-1.5 rounded-full pulse-soft" style="background: var(--color-health-500)"></span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}

			<div class="ml-auto flex items-center gap-1.5">
				<button onclick={() => (showFyModal = true)} disabled={!canCreate}
					class="rounded-md px-2.5 py-1 text-[0.75rem] font-medium transition-colors duration-150 disabled:cursor-not-allowed"
					style="color: {canCreate ? 'var(--color-slate-600)' : 'var(--color-slate-300)'}; border: 1px solid var(--color-slate-200); opacity: {canCreate ? '1' : '0.6'}">
					สร้างปีงบ
				</button>
				<button onclick={() => (showPlanImportModal = true)} disabled={!canCreate}
					class="rounded-md px-2.5 py-1 text-[0.75rem] font-medium transition-colors duration-150 disabled:cursor-not-allowed"
					style="color: {canCreate ? 'var(--color-slate-600)' : 'var(--color-slate-300)'}; border: 1px solid var(--color-slate-200); opacity: {canCreate ? '1' : '0.6'}">
					นำเข้า CSV
				</button>
				<button onclick={() => { creatingParentId = null; showCreateModal = true; }} disabled={!canCreate}
					class="rounded-md px-3 py-1 text-[0.75rem] font-medium text-white transition-all duration-200 disabled:cursor-not-allowed"
					style="background: {canCreate ? 'var(--color-brand-600)' : 'var(--color-slate-300)'}">
					สร้างแผนงาน
				</button>
			</div>
		</div>

		<!-- Row 2: Summary strip -->
		{#if activeFy}
			<div class="mt-2 grid grid-cols-4 gap-2">
				<div class="rounded-md px-3 py-2" style="background: var(--color-info-50)">
					<p class="text-[0.625rem] font-medium uppercase tracking-wider" style="color: var(--color-info-600)">คาดการณ์รายรับ</p>
					<p class="mt-0.5 text-sm font-bold tabular-nums" style="color: var(--color-info-800)">{formatBaht(String(activeFy.total_estimated_income))}</p>
				</div>
				<div class="rounded-md px-3 py-2" style="background: var(--color-orange-50)">
					<p class="text-[0.625rem] font-medium uppercase tracking-wider" style="color: var(--color-orange-600)">คาดการณ์รายจ่าย</p>
					<p class="mt-0.5 text-sm font-bold tabular-nums" style="color: var(--color-orange-800)">{formatBaht(String(activeFy.total_estimated_expense))}</p>
				</div>
				<div class="rounded-md px-3 py-2" style="background: var(--color-success-50)">
					<p class="text-[0.625rem] font-medium uppercase tracking-wider" style="color: var(--color-success-600)">รายรับจริง</p>
					<p class="mt-0.5 text-sm font-semibold tabular-nums" style="color: var(--color-success-800)">{formatBaht(String(activeFy.total_actual_income))}</p>
				</div>
				<div class="rounded-md px-3 py-2" style="background: var(--color-error-50)">
					<p class="text-[0.625rem] font-medium uppercase tracking-wider" style="color: var(--color-error-600)">รายจ่ายจริง</p>
					<p class="mt-0.5 text-sm font-semibold tabular-nums" style="color: var(--color-error-800)">{formatBaht(String(activeFy.total_actual_expense))}</p>
				</div>
			</div>
		{/if}

		<!-- Row 3: Search & Filters -->
		<div class="mt-2 flex items-center gap-2 flex-wrap">
			<div class="relative flex-[2]" style="min-width: 10rem">
				<svg class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style="color: var(--color-slate-400)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/></svg>
				<input type="text" placeholder="ค้นหาชื่อแผน, งบประมาณ, ระยะเวลา, หน่วยงาน..."
					bind:value={searchQuery}
					class="w-full rounded-md py-1.5 pl-8 pr-2 text-[0.8125rem] outline-none"
					style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
			</div>
			<div style="flex: 1 1 0; min-width: 8rem">
				<CustomSelect
					bind:value={filterPlanTypeStr}
					options={[{ value: 'INCOME', label: 'แผนรายรับ' }, { value: 'EXPENSE', label: 'แผนรายจ่าย' }]}
					placeholder="ประเภทแผน"
				/>
			</div>
			<div style="flex: 1 1 0; min-width: 8rem">
				<CustomSelect
					bind:value={filterResponsibleUnitStr}
					options={data.orgUnits.map((u) => ({ value: String(u.id), label: u.name }))}
					placeholder="หน่วยงานรับผิดชอบ"
				/>
			</div>
			<div style="flex: 1 1 0; min-width: 8rem">
				<CustomSelect
					bind:value={filterStakeholderUnitStr}
					options={data.orgUnits.map((u) => ({ value: String(u.id), label: u.name }))}
					placeholder="ผู้เกี่ยวข้อง"
				/>
			</div>
			<div class="flex items-center gap-1.5">
				<input type="number" placeholder="งบต่ำสุด" step="1000"
					bind:value={filterBudgetMin}
					class="w-28 rounded-md px-2.5 py-1.5 text-[0.8125rem] outline-none"
					style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
				<span class="text-[0.75rem]" style="color: var(--color-slate-400)">—</span>
				<input type="number" placeholder="งบสูงสุด" step="1000"
					bind:value={filterBudgetMax}
					class="w-28 rounded-md px-2.5 py-1.5 text-[0.8125rem] outline-none"
					style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
				<span class="text-[0.75rem] font-medium" style="color: var(--color-slate-400)">บาท</span>
			</div>
			{#if searchQuery || filterPlanTypeStr || filterResponsibleUnitStr || filterStakeholderUnitStr || filterBudgetMin || filterBudgetMax}
				<button onclick={() => { searchQuery = ''; filterPlanTypeStr = ''; filterResponsibleUnitStr = ''; filterStakeholderUnitStr = ''; filterBudgetMin = ''; filterBudgetMax = ''; }}
					class="rounded-md px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors duration-150"
					style="color: var(--color-error); background: var(--color-error-muted)">
					ล้างตัวกรอง
				</button>
			{/if}
		</div>
	</div>

	<!-- Plan Tree: full viewport height minus navbar -->
	<div class="mt-1.5 overflow-y-auto rounded-lg" style="height: calc(100vh - 5rem); border: 1px solid var(--color-slate-100); background: white; scrollbar-width: thin; scrollbar-color: var(--color-slate-300) transparent">
		<div class="p-4">
			{#if tree.length === 0}
				<div class="py-16 text-center" style="color: var(--color-slate-400)">
					<p class="text-sm">{data.selectedAgencyId ? (searchQuery || filterPlanType || filterResponsibleUnit || filterStakeholderUnit || filterBudgetMin || filterBudgetMax ? 'ไม่พบแผนงานที่ตรงกับเงื่อนไข' : 'ยังไม่มีแผนงาน') : 'กรุณาเลือกหน่วยงานก่อน'}</p>
				</div>
			{:else}
				<!-- Count + collapse all -->
				<div class="mb-3 flex items-center justify-between">
					<p class="text-[0.75rem]" style="color: var(--color-slate-400)">
						แผนงานทั้งหมด {tree.length} แผน
						{#if filteredPlans.length !== data.plans.length}
							<span style="color: var(--color-brand-500)">(กรอง {filteredPlans.length} จาก {data.plans.length} รายการ)</span>
						{/if}
					</p>
					<div class="flex items-center gap-2">
						<button onclick={() => { collapsed = new Set(); }}
							class="rounded px-2 py-1 text-[0.6875rem] font-medium transition-colors duration-150"
							style="color: var(--color-slate-500)">ขยายทั้งหมด</button>
						<button onclick={() => { collapsed = new Set(tree.map((n: any) => n.id)); }}
							class="rounded px-2 py-1 text-[0.6875rem] font-medium transition-colors duration-150"
							style="color: var(--color-slate-500)">ยุบทั้งหมด</button>
					</div>
				</div>

				<div class="space-y-1">
					{#each tree as rootNode, i}
						{@render planNode(rootNode, 0, i === tree.length - 1)}
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- ═══════════ MODALS ═══════════ -->

{#snippet formField(id: string, label: string, required?: boolean)}
	<label for={id} class="block text-[0.8125rem] font-medium" style="color: var(--color-slate-700)">
		{label}{#if required}<span style="color: var(--color-error)"> *</span>{/if}
	</label>
{/snippet}

<!-- Create Fiscal Year Modal -->
{#if showFyModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto fade-in"
		style="background: oklch(0.24 0.05 180 / 0.4); padding: clamp(2rem, 6vh, 4rem) 1rem"
		onclick={() => (showFyModal = false)}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="w-full scale-in" style="max-width: 32rem" onclick={(e) => e.stopPropagation()}>
			<div class="relative rounded-xl p-6" style="background: var(--color-slate-50); box-shadow: var(--shadow-xl)">
				<button onclick={() => (showFyModal = false)} title="ปิด" class="absolute right-3 top-3 rounded-md p-1 transition-colors duration-150" style="color: var(--color-slate-400)">
					<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
				</button>
				<h3 style="color: var(--color-slate-900)">สร้างปีงบประมาณ</h3>
				<form method="POST" action="?/duplicateFiscalYear" use:enhance={() => {
					return async ({ update, result }) => { showFyModal = false; if (result.type === 'success') showToast('สร้างปีงบประมาณสำเร็จ'); await update(); };
				}}>
					<input type="hidden" name="agency_id" value={data.selectedAgencyId || ''} />
					<div class="mt-5 space-y-4">
						<div>
							{@render formField('fy-year', 'ปีงบประมาณ (พ.ศ.)', true)}
							<input id="fy-year" name="year_name" maxlength="4" placeholder="เช่น 2569" required
								class="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none"
								style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
						</div>
						<div>
							{@render formField('fy-source', 'คัดลอกแผนจากปีงบประมาณ', false)}
							<select id="fy-source" name="source_fy_id"
								class="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none"
								style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white">
								<option value="">-- ไม่คัดลอก (สร้างว่าง) --</option>
								{#each data.fiscalYears as fy}
									<option value={fy.id}>ปี {fy.year_name}</option>
								{/each}
							</select>
							<p class="mt-1 text-xs" style="color: var(--color-slate-400)">คัดลอกแผนทั้งหมดจากปีที่เลือก (เฉพาะงบคาดการณ์ ไม่รวมยอดจริง)</p>
						</div>
					</div>
					<div class="mt-6 flex justify-end gap-2">
						<button type="button" onclick={() => (showFyModal = false)}
							class="rounded-lg px-3 py-2 text-sm font-medium" style="color: var(--color-slate-600)">ยกเลิก</button>
						<button type="submit" class="rounded-lg px-4 py-2 text-sm font-medium text-white"
							style="background: var(--color-brand-600)">บันทึก</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Create Plan Modal -->
{#if showCreateModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto fade-in"
		style="background: oklch(0.24 0.05 180 / 0.4); padding: clamp(2rem, 6vh, 4rem) 1rem"
		onclick={() => { showCreateModal = false; creatingParentId = null; createIsLeaf = false; }}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="w-full scale-in" style="max-width: 40rem" onclick={(e) => e.stopPropagation()}>
		<div class="relative rounded-xl p-6" style="background: var(--color-slate-50); box-shadow: var(--shadow-xl)">
			<button onclick={() => { showCreateModal = false; creatingParentId = null; createIsLeaf = false; }} title="ปิด" class="absolute right-3 top-3 rounded-md p-1 transition-colors duration-150" style="color: var(--color-slate-400)">
				<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
			</button>
			<h3 style="color: var(--color-slate-900)">{isSubPlan ? 'สร้างแผนย่อย' : 'สร้างแผนงาน'}</h3>

			{#if parentPlan}
				<div class="mt-3 rounded-lg p-3" style="background: var(--color-brand-50)">
					<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-brand-500)">แผนแม่</p>
					<p class="mt-0.5 text-sm font-semibold" style="color: var(--color-slate-800)">{parentPlan.title}</p>
					<p class="mt-0.5 text-[0.75rem]" style="color: var(--color-slate-500)">
						{parentPlan.plan_type === 'INCOME' ? 'รายรับ' : 'รายจ่าย'}
						{#if parentPlan.start_date} / {parentPlan.start_date} — {parentPlan.end_date}{/if}
						{#if getOrgUnitName(parentPlan.responsible_unit_id)} / {getOrgUnitName(parentPlan.responsible_unit_id)}{/if}
					</p>
				</div>
			{/if}

			<form method="POST" action="?/createPlan" use:enhance={() => {
				return async ({ update, result }) => { showCreateModal = false; creatingParentId = null; createIsLeaf = false; if (result.type === 'success') showToast('สร้างแผนงานสำเร็จ'); await update(); };
			}}>
				<input type="hidden" name="agency_id" value={data.selectedAgencyId || ''} />
				<input type="hidden" name="fiscal_year_id" value={data.selectedFyId || ''} />
				<input type="hidden" name="parent_id" value={creatingParentId || ''} />
				{#if isSubPlan && parentPlan}
					<input type="hidden" name="plan_type" value={parentPlan.plan_type} />
				{/if}

				<div class="mt-5 space-y-4">
					<div>
						{@render formField('c-title', 'ชื่อแผน/โครงการ/กิจกรรม', true)}
						<input id="c-title" name="title" required
							class="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none"
							style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
					</div>

					{#if !isSubPlan}
						<div class="grid grid-cols-2 gap-3">
							<div>
								{@render formField('c-type', 'ประเภท', true)}
								<div class="mt-1">
									<CustomSelect
										name="plan_type"
										value="EXPENSE"
										options={[{ value: 'EXPENSE', label: 'รายจ่าย' }, { value: 'INCOME', label: 'รายรับ' }]}
										required
										id="c-type"
									/>
								</div>
							</div>
							<div>
								{@render formField('c-unit', 'หน่วยงานรับผิดชอบ', true)}
								<div class="mt-1">
									<CustomSelect
										name="responsible_unit_id"
										options={data.orgUnits.map((u) => ({ value: String(u.id), label: u.name }))}
										placeholder="-- เลือกหน่วยงาน --"
										required
										id="c-unit"
									/>
								</div>
							</div>
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-3">
							<div>
								<p class="text-[0.8125rem] font-medium" style="color: var(--color-slate-700)">ประเภท</p>
								<div class="mt-1 rounded-lg px-3 py-2 text-sm" style="background: var(--color-slate-100); color: var(--color-slate-500)">
									{parentPlan?.plan_type === 'INCOME' ? 'รายรับ' : 'รายจ่าย'}
								</div>
							</div>
							{#each [data.orgUnits.filter(u => u.parent_id === parentPlan?.responsible_unit_id)] as subUnits}
							<div>
								{@render formField('c-sub-unit', 'หน่วยงานย่อยรับผิดชอบ', true)}
								<div class="mt-1">
									{#if subUnits.length > 0}
										<CustomSelect
											name="responsible_unit_id"
											options={subUnits.map((u) => ({ value: String(u.id), label: u.name }))}
											placeholder="-- เลือกหน่วยย่อย --"
											required
											id="c-sub-unit"
										/>
									{:else}
										<div class="rounded-lg px-3 py-2 text-sm" style="background: var(--color-amber-50); color: var(--color-amber-700)">
											ไม่มีหน่วยย่อยในหน่วย "{getOrgUnitName(parentPlan?.responsible_unit_id ?? null)}" — กรุณาเพิ่มหน่วยย่อยก่อน
										</div>
									{/if}
								</div>
							</div>
							{/each}
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-3">
						<div>
							{@render formField('c-start', 'วันที่เริ่ม', true)}
							<CustomDatePicker name="start_date" required min={parentMinDate || ''} max={parentMaxDate || ''} id="c-start" class="mt-1" />
						</div>
						<div>
							{@render formField('c-end', 'วันที่สิ้นสุด', true)}
							<CustomDatePicker name="end_date" required min={parentMinDate || ''} max={parentMaxDate || ''} id="c-end" class="mt-1" />
						</div>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							{@render formField('c-desc', 'กิจกรรม/ขั้นตอน')}
							<textarea id="c-desc" name="description" rows="3" placeholder="อธิบายกิจกรรม"
								class="mt-1 block w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
								style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white"></textarea>
						</div>
						<div>
							{@render formField('c-outputs', 'ผลผลิตที่คาดหวัง')}
							<textarea id="c-outputs" name="expected_outputs" rows="3" placeholder="บรรทัดละรายการ"
								class="mt-1 block w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
								style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white"></textarea>
						</div>
					</div>

					{#if !isSubPlan}
						<div>
							<p class="text-[0.8125rem] font-medium" style="color: var(--color-slate-700)">ผู้เกี่ยวข้อง (หน่วยงาน)<span style="color: var(--color-error)"> *</span></p>
							<div class="mt-1 max-h-24 overflow-y-auto rounded-lg p-2 space-y-0.5" style="border: 1px solid var(--color-slate-200); background: white">
								{#each data.orgUnits as unit}
									<label class="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer"
										style="color: var(--color-slate-700)">
										<input type="checkbox" name="stakeholder_unit_check" value={unit.id}
											style="accent-color: var(--color-brand-600)"
											onchange={(e) => {
												const form = (e.target as HTMLInputElement).closest('form');
												if (!form) return;
												const checks = form.querySelectorAll<HTMLInputElement>('input[name="stakeholder_unit_check"]:checked');
												const hidden = form.querySelector<HTMLInputElement>('input[name="stakeholder_unit_ids"]');
												if (hidden) hidden.value = Array.from(checks).map(c => c.value).join(',');
												const reqInput = form.querySelector<HTMLInputElement>('input[name="stakeholder_required"]');
												if (reqInput) reqInput.value = checks.length > 0 ? 'ok' : '';
											}} />
										{unit.name}
									</label>
								{/each}
							</div>
							<input type="hidden" name="stakeholder_unit_ids" value="" />
							<input type="hidden" name="stakeholder_required" value="" required
								oninvalid={(e) => { (e.target as HTMLInputElement).setCustomValidity('กรุณาเลือกหน่วยงานที่เกี่ยวข้องอย่างน้อย 1 หน่วย'); }}
								oninput={(e) => { (e.target as HTMLInputElement).setCustomValidity(''); }} />
						</div>
					{:else if Array.isArray(parentPlan?.stakeholder_unit_ids) && parentPlan.stakeholder_unit_ids.length > 0}
						<div>
							<p class="text-[0.8125rem] font-medium" style="color: var(--color-slate-700)">ผู้เกี่ยวข้อง (หน่วยงาน)</p>
							<div class="mt-1 flex flex-wrap gap-1.5">
								{#each parentPlan.stakeholder_unit_ids as sid}
									{#if getOrgUnitName(sid)}
										<span class="rounded-md px-2.5 py-1 text-[0.75rem] font-medium" style="background: var(--color-brand-50); color: var(--color-brand-700)">{getOrgUnitName(sid)}</span>
									{/if}
								{/each}
							</div>
							<input type="hidden" name="stakeholder_unit_ids" value={parentPlan.stakeholder_unit_ids.join(',')} />
						</div>
					{/if}

					<div class="flex items-center gap-4">
						<label class="flex items-center gap-2 text-sm cursor-pointer" style="color: var(--color-slate-700)">
							<input type="checkbox" name="is_leaf_node" value="true" style="accent-color: var(--color-brand-600)"
								onchange={(e) => { createIsLeaf = (e.target as HTMLInputElement).checked; }} />
							รายการพร้อมจัดซื้อจัดจ้าง
						</label>
						{#if createIsLeaf}
							<div class="flex-1">
								{@render formField('c-amount', 'งบประมาณ (บาท)')}
								<input id="c-amount" name="estimated_amount" type="number" step="0.01" value="0"
									class="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none"
									style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
							</div>
						{:else}
							<p class="text-[0.75rem]" style="color: var(--color-warning)">งบประมาณคำนวณอัตโนมัติจากแผนย่อย</p>
						{/if}
					</div>
				</div>

				<div class="mt-6 flex justify-end gap-2">
					<button type="button" onclick={() => { showCreateModal = false; creatingParentId = null; createIsLeaf = false; }}
						class="rounded-lg px-3 py-2 text-sm font-medium" style="color: var(--color-slate-600)">ยกเลิก</button>
					<button type="submit" class="rounded-lg px-4 py-2 text-sm font-medium text-white"
						style="background: var(--color-brand-600)">บันทึก</button>
				</div>
			</form>
		</div>
		</div>
	</div>
{/if}

<!-- Edit Plan Modal -->
{#if editingPlan}
	{@const editParent = getParentPlan(editingPlan.parent_id)}
	{@const isEditRoot = !editingPlan.parent_id}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto fade-in"
		style="background: oklch(0.24 0.05 180 / 0.4); padding: clamp(2rem, 6vh, 4rem) 1rem"
		onclick={() => { editingPlan = null; editIsLeaf = false; }}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="w-full scale-in" style="max-width: 40rem" onclick={(e) => e.stopPropagation()}>
		<div class="relative rounded-xl p-6" style="background: var(--color-slate-50); box-shadow: var(--shadow-xl)">
			<button onclick={() => { editingPlan = null; editIsLeaf = false; }} title="ปิด" class="absolute right-3 top-3 rounded-md p-1 transition-colors duration-150" style="color: var(--color-slate-400)">
				<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
			</button>
			<h3 style="color: var(--color-slate-900)">แก้ไขแผนงาน</h3>

			{#if editParent}
				<div class="mt-3 rounded-lg p-3" style="background: var(--color-brand-50)">
					<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-brand-500)">แผนแม่</p>
					<p class="mt-0.5 text-sm font-semibold" style="color: var(--color-slate-800)">{editParent.title}</p>
				</div>
			{/if}

			<form method="POST" action="?/updatePlan" use:enhance={() => {
				return async ({ update, result }) => { editingPlan = null; editIsLeaf = false; if (result.type === 'success') showToast('แก้ไขแผนงานสำเร็จ'); await update(); };
			}}>
				<input type="hidden" name="id" value={editingPlan.id} />
				<div class="mt-5 space-y-4">
					<div>
						{@render formField('e-title', 'ชื่อแผน/โครงการ/กิจกรรม')}
						<input id="e-title" name="title" value={editingPlan.title} required
							class="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none"
							style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
					</div>

					{#if isEditRoot}
						<div>
							{@render formField('e-unit', 'หน่วยงานรับผิดชอบ')}
							<div class="mt-1">
								<CustomSelect
									name="responsible_unit_id"
									value={editingPlan.responsible_unit_id ? String(editingPlan.responsible_unit_id) : ''}
									options={data.orgUnits.map((u) => ({ value: String(u.id), label: u.name }))}
									placeholder="-- ไม่ระบุ --"
									id="e-unit"
								/>
							</div>
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-3">
							<div>
								<p class="text-[0.8125rem] font-medium" style="color: var(--color-slate-700)">ประเภท</p>
								<div class="mt-1 rounded-lg px-3 py-2 text-sm" style="background: var(--color-slate-100); color: var(--color-slate-500)">{editingPlan.plan_type === 'INCOME' ? 'รายรับ' : 'รายจ่าย'}</div>
							</div>
							{#each [data.orgUnits.filter(u => u.parent_id === editParent?.responsible_unit_id)] as editSubUnits}
							<div>
								{@render formField('e-sub-unit', 'หน่วยงานย่อยรับผิดชอบ')}
								<div class="mt-1">
									{#if editSubUnits.length > 0}
										<CustomSelect
											name="responsible_unit_id"
											value={editingPlan.responsible_unit_id ? String(editingPlan.responsible_unit_id) : ''}
											options={editSubUnits.map((u) => ({ value: String(u.id), label: u.name }))}
											placeholder="-- เลือกหน่วยย่อย --"
											id="e-sub-unit"
										/>
									{:else}
										<div class="rounded-lg px-3 py-2 text-sm" style="background: var(--color-amber-50); color: var(--color-amber-700)">
											ไม่มีหน่วยย่อย
										</div>
									{/if}
								</div>
							</div>
							{/each}
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-3">
						<div>
							{@render formField('e-start', 'วันที่เริ่ม')}
							<CustomDatePicker name="start_date" value={editingPlan.start_date || ''} min={editParent?.start_date || ''} max={editParent?.end_date || ''} id="e-start" class="mt-1" />
						</div>
						<div>
							{@render formField('e-end', 'วันที่สิ้นสุด')}
							<CustomDatePicker name="end_date" value={editingPlan.end_date || ''} min={editParent?.start_date || ''} max={editParent?.end_date || ''} id="e-end" class="mt-1" />
						</div>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							{@render formField('e-desc', 'กิจกรรม/ขั้นตอน')}
							<textarea id="e-desc" name="description" rows="3"
								class="mt-1 block w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
								style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white">{editingPlan.description || ''}</textarea>
						</div>
						<div>
							{@render formField('e-outputs', 'ผลผลิตที่คาดหวัง')}
							<textarea id="e-outputs" name="expected_outputs" rows="3"
								class="mt-1 block w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
								style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white">{Array.isArray(editingPlan.expected_outputs) ? editingPlan.expected_outputs.join('\n') : (editingPlan.expected_outputs?.outputs ? editingPlan.expected_outputs.outputs.join('\n') : (typeof editingPlan.expected_outputs === 'string' ? editingPlan.expected_outputs : ''))}</textarea>
						</div>
					</div>

					<div>
						<p class="text-[0.8125rem] font-medium" style="color: var(--color-slate-700)">ผู้เกี่ยวข้อง (หน่วยงาน)</p>
						<div class="mt-1 max-h-24 overflow-y-auto rounded-lg p-2 space-y-0.5" style="border: 1px solid var(--color-slate-200); background: white">
							{#each data.orgUnits as unit}
								<label class="flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer" style="color: var(--color-slate-700)">
									<input type="checkbox" name="edit_stakeholder_check" value={unit.id}
										checked={Array.isArray(editingPlan.stakeholder_unit_ids) && editingPlan.stakeholder_unit_ids.includes(unit.id)}
										style="accent-color: var(--color-brand-600)"
										onchange={(e) => {
											const form = (e.target as HTMLInputElement).closest('form');
											if (!form) return;
											const checks = form.querySelectorAll<HTMLInputElement>('input[name="edit_stakeholder_check"]:checked');
											const hidden = form.querySelector<HTMLInputElement>('input[name="stakeholder_unit_ids"]');
											if (hidden) hidden.value = Array.from(checks).map(c => c.value).join(',');
										}} />
									{unit.name}
								</label>
							{/each}
						</div>
						<input type="hidden" name="stakeholder_unit_ids" value={Array.isArray(editingPlan.stakeholder_unit_ids) ? editingPlan.stakeholder_unit_ids.join(',') : ''} />
					</div>

					<div class="flex items-center gap-4">
						<label class="flex items-center gap-2 text-sm cursor-pointer" style="color: var(--color-slate-700)">
							<input type="checkbox" name="is_leaf_node" value="true" checked={editingPlan.is_leaf_node} style="accent-color: var(--color-brand-600)"
								onchange={(e) => { editIsLeaf = (e.target as HTMLInputElement).checked; }} />
							รายการพร้อมจัดซื้อจัดจ้าง
						</label>
						{#if editIsLeaf}
							<div class="flex-1">
								{@render formField('e-amount', 'งบประมาณ (บาท)')}
								<input id="e-amount" name="estimated_amount" type="number" step="0.01" value={editingPlan.estimated_amount}
									class="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none"
									style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
							</div>
						{:else}
							<p class="text-[0.75rem]" style="color: var(--color-warning)">งบประมาณคำนวณอัตโนมัติจากแผนย่อย</p>
						{/if}
					</div>
				</div>

				<div class="mt-6 flex justify-end gap-2">
					<button type="button" onclick={() => { editingPlan = null; editIsLeaf = false; }}
						class="rounded-lg px-3 py-2 text-sm font-medium" style="color: var(--color-slate-600)">ยกเลิก</button>
					<button type="submit" class="rounded-lg px-4 py-2 text-sm font-medium text-white"
						style="background: var(--color-brand-600)">บันทึก</button>
				</div>
			</form>
		</div>
		</div>
	</div>
{/if}

<!-- Detail View Modal -->
{#if viewingPlan}
	{@const vParent = getParentPlan(viewingPlan.parent_id)}
	{@const vProgress = budgetProgress(viewingPlan.estimated_amount, viewingPlan.actual_amount)}
	{@const vUnit = getOrgUnitName(viewingPlan.responsible_unit_id)}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto fade-in"
		style="background: oklch(0.24 0.05 180 / 0.4); padding: clamp(2rem, 6vh, 4rem) 1rem"
		onclick={() => (viewingPlan = null)}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="w-full scale-in" style="max-width: 36rem" onclick={(e) => e.stopPropagation()}>
			<div class="relative overflow-hidden rounded-xl" style="background: var(--color-slate-50); box-shadow: var(--shadow-xl)">

				<!-- Close -->
				<button onclick={() => (viewingPlan = null)} title="ปิด"
					class="absolute right-3 top-3 z-10 rounded-md p-1 transition-colors duration-150"
					style="color: var(--color-slate-400)"
					onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-slate-700)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-slate-100)' }}
					onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-slate-400)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
				</button>

				<!-- Header -->
				<div class="px-6 pt-5 pb-4" style="border-bottom: 1px solid var(--color-slate-200)">
					<div class="flex items-baseline gap-2 pr-8 flex-wrap">
						<h3 style="color: var(--color-slate-900)">{viewingPlan.title}</h3>
						<span class="rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide"
							style="background: {viewingPlan.plan_type === 'INCOME' ? 'var(--color-health-100)' : 'var(--color-brand-100)'}; color: {viewingPlan.plan_type === 'INCOME' ? 'var(--color-health-700)' : 'var(--color-brand-700)'}">
							{viewingPlan.plan_type === 'INCOME' ? 'รายรับ' : 'รายจ่าย'}
						</span>
						{#if viewingPlan.is_leaf_node}
							<span class="rounded px-1.5 py-0.5 text-[0.625rem] font-medium" style="background: var(--color-info-muted); color: var(--color-brand-700)">พร้อมจัดซื้อ</span>
						{/if}
					</div>
					{#if vParent}
						<p class="mt-1 text-[0.8125rem]" style="color: var(--color-slate-400)">แผนแม่: {vParent.title}</p>
					{/if}
				</div>

				<!-- Body -->
				<div class="px-6 py-5" style="display: grid; gap: clamp(1rem, 2.5vw, 1.5rem)">

					<!-- Budget -->
					<div class="rounded-lg p-4" style="background: white; border: 1px solid var(--color-slate-100)">
						<div class="grid grid-cols-2 gap-4">
							<div>
								<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-slate-400)">งบประมาณที่ตั้งไว้</p>
								<p class="mt-0.5 text-lg font-bold" style="color: var(--color-slate-900)">{formatBaht(viewingPlan.estimated_amount)}</p>
							</div>
							<div class="text-right">
								<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-slate-400)">เบิกจ่ายจริง</p>
								<p class="mt-0.5 text-lg font-bold" style="color: var(--color-slate-900)">{formatBaht(viewingPlan.actual_amount)}</p>
							</div>
						</div>
						{#if Number(viewingPlan.estimated_amount) > 0}
							{@const vRawPercent = budgetRawPercent(viewingPlan.estimated_amount, viewingPlan.actual_amount)}
							{@const vBarColor = budgetBarColor(viewingPlan.plan_type, vRawPercent)}
							<div class="mt-3 h-1.5 w-full overflow-hidden rounded-full" style="background: var(--color-slate-100)">
								<div class="h-full rounded-full" style="width: {vProgress}%; background: {vBarColor}; transition: width 0.5s var(--ease-out-expo)"></div>
							</div>
							<p class="mt-1 text-right text-[0.6875rem] font-medium"
								style="color: {vBarColor}">
								ใช้ไป {vProgress}%{#if vRawPercent > 100} <span style="color: var(--color-error)">(เกินงบ {vRawPercent}%)</span>{/if}
							</p>
						{/if}
					</div>

					<!-- Info grid: asymmetric -->
					{#if viewingPlan.start_date || vUnit}
						<div class="grid gap-4" style="grid-template-columns: {viewingPlan.start_date && vUnit ? '1.3fr 1fr' : '1fr'}">
							{#if viewingPlan.start_date}
								<div>
									<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-slate-400)">ระยะเวลาดำเนินการ</p>
									<p class="mt-1 text-sm font-medium" style="color: var(--color-slate-800)">
										{viewingPlan.start_date} — {viewingPlan.end_date || '...'}
									</p>
									{#if viewingPlan.duration_text}
										<p class="text-[0.75rem]" style="color: var(--color-slate-500)">{viewingPlan.duration_text}</p>
									{/if}
								</div>
							{/if}
							{#if vUnit}
								<div>
									<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-slate-400)">หน่วยงานรับผิดชอบ</p>
									<p class="mt-1 text-sm font-medium" style="color: var(--color-slate-800)">{vUnit}</p>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Stakeholders -->
					{#if Array.isArray(viewingPlan.stakeholder_unit_ids) && viewingPlan.stakeholder_unit_ids.length > 0}
						<div>
							<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-slate-400)">หน่วยงานที่เกี่ยวข้อง</p>
							<div class="mt-2 flex flex-wrap gap-1.5">
								{#each viewingPlan.stakeholder_unit_ids as sid}
									{#if getOrgUnitName(sid)}
										<span class="rounded-md px-2.5 py-1 text-[0.75rem] font-medium"
											style="background: var(--color-brand-50); color: var(--color-brand-700)">{getOrgUnitName(sid)}</span>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					<!-- Description -->
					<div>
						<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-slate-400)">กิจกรรม/ขั้นตอน</p>
						<div class="mt-2 overflow-y-auto rounded-lg p-3" style="background: white; border: 1px solid var(--color-slate-100); height: 8rem">
							<p class="whitespace-pre-wrap text-sm leading-relaxed" style="color: var(--color-slate-700); overflow-wrap: anywhere">{viewingPlan.description || '-'}</p>
						</div>
					</div>

					<!-- Expected outputs -->
					<div>
						<p class="text-[0.6875rem] font-medium uppercase tracking-wider" style="color: var(--color-slate-400)">ผลผลิตที่คาดหวัง</p>
						<div class="mt-2 overflow-y-auto rounded-lg p-3" style="background: var(--color-warning-muted); border: 1px solid oklch(0.90 0.04 85); height: 4rem">
							<p class="whitespace-pre-wrap text-sm leading-relaxed" style="color: var(--color-slate-700); overflow-wrap: anywhere">{Array.isArray(viewingPlan.expected_outputs) && viewingPlan.expected_outputs.length > 0 ? viewingPlan.expected_outputs.join('\n') : (viewingPlan.expected_outputs?.outputs ? viewingPlan.expected_outputs.outputs.join('\n') : '-')}</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirm Modal -->
{#if deletingPlan}
	{@const hasChildPlans = data.plans.some((p: any) => p.parent_id === deletingPlan.id)}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center fade-in"
		style="background: oklch(0.24 0.05 180 / 0.4); padding: 1rem"
		onclick={() => (deletingPlan = null)}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="w-full scale-in" style="max-width: 26rem" onclick={(e) => e.stopPropagation()}>
			<div class="rounded-xl p-6 text-center" style="background: var(--color-slate-50); box-shadow: var(--shadow-xl)">
				<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style="background: var(--color-error-muted)">
					<svg class="h-7 w-7" style="color: var(--color-error)" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold" style="color: var(--color-slate-900)">ยืนยันการลบแผนงาน</h3>
				<p class="mt-2 text-sm" style="color: var(--color-slate-600)">
					ต้องการลบ <strong style="color: var(--color-slate-800)">{deletingPlan.title}</strong> ใช่หรือไม่?
				</p>
				{#if hasChildPlans}
					<p class="mt-3 rounded-md px-3 py-2 text-[0.8125rem] font-medium" style="background: var(--color-error-muted); color: var(--color-error)">
						แผนงานย่อยทั้งหมดภายใต้แผนนี้จะถูกลบด้วย
					</p>
				{/if}
				<div class="mt-5 flex justify-center gap-3">
					<button onclick={() => (deletingPlan = null)}
						class="rounded-lg px-4 py-2 text-sm font-medium" style="color: var(--color-slate-600); border: 1px solid var(--color-slate-200)">ยกเลิก</button>
					<form method="POST" action="?/deletePlan" use:enhance={() => {
						return async ({ update }) => {
							showToast('ลบแผนงานสำเร็จ', 'error');
							deletingPlan = null;
							await update();
						};
					}}>
						<input type="hidden" name="id" value={deletingPlan.id} />
						<button type="submit" class="rounded-lg px-4 py-2 text-sm font-medium text-white"
							style="background: var(--color-error)">ลบแผนงาน</button>
					</form>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Toast notifications handled by global Toast component -->

<!-- Import Plan CSV Modal -->
{#if showPlanImportModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px);">
		<div class="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl" style="animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);" onclick={(e) => e.stopPropagation()}>
			<h2 class="mb-4 text-lg font-semibold" style="color: oklch(0.2 0.02 180);">นำเข้าแผนงานจาก CSV</h2>
			<p class="text-sm" style="color: oklch(0.5 0.02 180);">นำเข้าแผนงานสำหรับปีงบประมาณที่เลือกอยู่</p>

			<div class="mt-3 rounded-lg p-4" style="border: 1px dashed oklch(0.82 0.015 180); background: oklch(0.98 0.005 180);">
				<p class="text-xs mb-2" style="color: oklch(0.5 0.02 180);">คอลัมน์ที่รองรับ:</p>
				<p class="text-xs font-mono" style="color: oklch(0.35 0.02 180);">ชื่อแผน*, ประเภท*, วันเริ่มต้น*, วันสิ้นสุด*, แผนแม่, หน่วยรับผิดชอบ, หน่วยงานที่เกี่ยวข้อง, รายละเอียด, ผลผลิตที่คาดหวัง, เป็นแผนย่อยสุด, งบประมาณ</p>
				<p class="text-xs mt-1" style="color: oklch(0.6 0.02 180);">* = จำเป็น | ประเภท: INCOME/EXPENSE | วันที่: YYYY-MM-DD | แผนแม่: ใส่ชื่อแผนที่มีอยู่แล้ว | หน่วยงานที่เกี่ยวข้อง: คั่นด้วย , | เป็นแผนย่อยสุด: ใช่/ไม่ใช่</p>
				<button type="button" onclick={() => downloadCsvTemplate('plans',
					['ชื่อแผน', 'ประเภท', 'วันเริ่มต้น', 'วันสิ้นสุด', 'แผนแม่', 'หน่วยรับผิดชอบ', 'หน่วยงานที่เกี่ยวข้อง', 'รายละเอียด', 'ผลผลิตที่คาดหวัง', 'เป็นแผนย่อยสุด', 'งบประมาณ'],
					[
						['แผนพัฒนาระบบสุขภาพ', 'EXPENSE', '2026-10-01', '2027-09-30', '', 'กองแผนงาน', 'กองแผนงาน, กองการเงิน', 'แผนหลักด้านสุขภาพ', '', 'ไม่ใช่', ''],
						['โครงการจัดซื้อเวชภัณฑ์', 'EXPENSE', '2026-10-01', '2027-03-31', 'แผนพัฒนาระบบสุขภาพ', 'กองพัสดุ', 'กองพัสดุ', 'จัดซื้อยาและเวชภัณฑ์ประจำปี', 'ยาสามัญพร้อมใช้', 'ใช่', '500000'],
						['แผนรายรับค่าบริการ', 'INCOME', '2026-10-01', '2027-09-30', '', 'กองการเงิน', 'กองการเงิน', 'รายรับจากค่าบริการทางการแพทย์', '', 'ใช่', '2000000'],
					]
				)} class="mt-2 text-xs hover:underline cursor-pointer" style="color: oklch(0.42 0.12 240); background: none; border: none;">
					ดาวน์โหลด Template CSV
				</button>
			</div>

			<form method="POST" action="?/importPlanCsv" enctype="multipart/form-data" use:enhance={() => {
				return async ({ update }) => { showPlanImportModal = false; await update(); };
			}}>
				<input type="hidden" name="agency_id" value={data.selectedAgencyId || ''} />
				<input type="hidden" name="fiscal_year_id" value={data.selectedFyId || ''} />
				<div class="mt-4">
					<input name="csv_file" type="file" accept=".csv" required class="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
				</div>
				<div class="mt-6 flex justify-end gap-3">
					<button type="button" onclick={() => (showPlanImportModal = false)} class="rounded-lg px-4 py-2 text-sm" style="color: oklch(0.45 0.02 180);">ยกเลิก</button>
					<button type="submit" class="rounded-lg px-4 py-2 text-sm font-medium text-white" style="background: oklch(0.52 0.14 240);">นำเข้า</button>
				</div>
			</form>
		</div>
	</div>
{/if}
