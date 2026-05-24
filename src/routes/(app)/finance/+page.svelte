<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ScopeSelector from '$lib/components/ScopeSelector.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import CustomDatePicker from '$lib/components/CustomDatePicker.svelte';
	import { formatBaht, formatNumber, exportToCsv, downloadCsvTemplate } from '$lib/utils/format';
	import { getBankLogo } from '$lib/utils/bank-logo';
	import { watchFormResult } from '$lib/stores/toast.svelte';
	import { swalConfirmDelete } from '$lib/utils/swal';
	import { decrementFinance } from '$lib/stores/taskCounts.svelte';

	let { data, form: formResult } = $props();

	watchFormResult(() => formResult);
	let canManageFinance = $derived(data.user.is_super_admin || data.user.permissions.can_manage_finance);
	// ผอ./รองผอ. ที่ไม่ใช่ super admin — หน้าที่หลักคืออนุมัติ (EXAMINED) เท่านั้น
	// ไม่ว่าจะมี can_manage_finance หรือไม่ก็ตาม
	let isDirectorOnly = $derived(data.user.is_director && !data.user.is_super_admin);
	// ใครบ้างที่อนุมัติได้
	let canApprove = $derived(data.user.is_super_admin || data.user.is_director);

	// "งานของฉัน" — แสดงเฉพาะฎีกาที่เป็นงานของตัวเองจริงๆ (ไม่กรองตามปีงบ เพื่อให้ตรงกับ badge ใน sidebar)
	let myDikaTasks = $derived.by(() => {
		if (isDirectorOnly) {
			// ผอ./รองผอ. เห็นเฉพาะ EXAMINED (รออนุมัติ)
			return data.dikaVouchers.filter((d: any) => d.status === 'EXAMINED');
		}
		return data.dikaVouchers.filter((d: any) => {
			if (d.status === 'PENDING_EXAMINE' && canManageFinance) return true;
			if (d.status === 'EXAMINED' && canApprove) return true;
			if (d.status === 'APPROVED' && canManageFinance) return true;
			return false;
		});
	});
	let activeTab = $state<'dika' | 'accounts' | 'tax' | 'vendors' | 'loans'>('dika');
	let showCreateAccountModal = $state(false);
	let showCreateLoanModal = $state(false);
	let selectedDika = $state<any>(null);
	let payAccountId = $state('');
	let payTaxAccountId = $state('');
	let selectedLoanType = $state('');
	const perPage = 5;

	// Pagination states
	let dikaPage = $state(1);
	let taxPage = $state(1);
	let vendorPage = $state(1);
	let loanPage = $state(1);

	// Filter states
	let vendorTypeFilter = $state('');
	let vendorSearch = $state('');
	let showAccountTypeModal = $state(false);
	let showAccountImportModal = $state(false);
	let showVendorModal = $state(false);
	let showVendorImportModal = $state(false);
	let editingVendor = $state<any>(null);
	let showVendorTypeModal = $state(false);
	let canManageVendors = $derived(data.user.is_super_admin || data.user.is_director || data.user.permissions.can_manage_finance);
	let loanTypeFilter = $state('');
	let selectedFyId = $state<number | null>(null);

	// Auto-select active fiscal year
	$effect(() => {
		if (selectedFyId === null && data.fiscalYears?.length > 0) {
			selectedFyId = data.fiscalYears.find((fy: any) => fy.is_active)?.id ?? null;
		}
	});

	// Fiscal year filtered data (dika, tax, loans)
	// ตารางแสดงฎีกาทุกสถานะ — "งานของฉัน" จะกรองเฉพาะที่ตนรับผิดชอบแยกต่างหาก
	let fyFilteredDika = $derived.by(() => {
		return selectedFyId ? data.dikaVouchers.filter((d: any) => d.fiscal_year_id === selectedFyId) : data.dikaVouchers;
	});
	let fyFilteredTax = $derived(
		selectedFyId ? data.taxTransactions.filter((t: any) => t.fiscal_year_id === selectedFyId) : data.taxTransactions
	);
	let fyFilteredLoans = $derived.by(() => {
		let list = data.loans;
		if (loanTypeFilter) list = list.filter((l: any) => l.loan_type !== loanTypeFilter ? false : true);
		return list;
	});

	// Derived data
	let paginatedDika = $derived(
		fyFilteredDika.slice((dikaPage - 1) * perPage, dikaPage * perPage)
	);
	let paginatedTax = $derived(
		fyFilteredTax.slice((taxPage - 1) * perPage, taxPage * perPage)
	);
	let filteredVendors = $derived(
		data.vendors.filter((v: any) => {
			if (vendorTypeFilter && String(v.vendor_type_id) !== vendorTypeFilter) return false;
			if (vendorSearch) {
				const q = vendorSearch.toLowerCase();
				return v.company_name.toLowerCase().includes(q) || v.tax_id.includes(q);
			}
			return true;
		})
	);
	let paginatedVendors = $derived(
		filteredVendors.slice((vendorPage - 1) * perPage, vendorPage * perPage)
	);
	let filteredLoans = $derived(fyFilteredLoans);
	let paginatedLoans = $derived(
		filteredLoans.slice((loanPage - 1) * perPage, loanPage * perPage)
	);

	function exportDika() {
		exportToCsv('dika-vouchers', [
			{ key: 'id', label: 'รหัส' },
			{ key: 'vendor_name', label: 'ผู้รับจ้าง' },
			{ key: 'plan_title', label: 'แผนงาน' },
			{ key: 'net_amount', label: 'ยอดสุทธิ (บาท)' },
			{ key: 'status', label: 'สถานะ' }
		], data.dikaVouchers);
	}

	function exportTax() {
		exportToCsv('tax-transactions', [
			{ key: 'tax_id', label: 'เลขผู้เสียภาษี' },
			{ key: 'tax_form_type', label: 'แบบ' },
			{ key: 'tax_base_amount', label: 'ฐานภาษี (บาท)' },
			{ key: 'tax_amount', label: 'ภาษี (บาท)' },
			{ key: 'status', label: 'สถานะ' }
		], data.taxTransactions);
	}
</script>

<div>
	<PageHeader title="การเงินและเบิกจ่าย" subtitle="จัดการฎีกาเบิกจ่าย บัญชีธนาคาร และภาษี" />

	{#if data.user.is_super_admin}
		<ScopeSelector
			provinces={data.provinces}
			agencies={data.agencies}
			orgUnits={[]}
			selectedProvinceId={data.selectedProvinceId}
			selectedAgencyId={data.selectedAgencyId}
			isSuperAdmin={true}
			basePath="/finance"
			compact={true}
		/>
	{/if}

	<!-- Toast notifications are now handled by the global Toast component -->

	<!-- Tabs -->
	<div class="mt-6 flex gap-1 border-b">
		{#each [{ key: 'dika', label: 'ฎีกาเบิกจ่าย' }, { key: 'accounts', label: 'บัญชีธนาคาร' }, { key: 'tax', label: 'ภาษี' }, { key: 'vendors', label: 'ผู้ประกอบการ' }, { key: 'loans', label: 'ยืมเงิน' }] as tab}
			<button
				onclick={() => (activeTab = tab.key as any)}
				class="rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors
					{activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Fiscal Year Filter + Export (for dika, tax, loans tabs) -->
	{#if ['dika', 'tax', 'loans'].includes(activeTab)}
		<div class="mt-2 flex items-center gap-2">
			{#if data.fiscalYears?.length > 0}
				<div class="flex items-center gap-1">
					<button class="rounded-md px-3 py-1 text-[0.75rem] font-medium transition-colors"
						style="color: {!selectedFyId ? 'oklch(0.42 0.14 240)' : 'oklch(0.5 0.02 180)'}; background: {!selectedFyId ? 'oklch(0.52 0.14 240 / 0.08)' : 'transparent'}"
						onclick={() => (selectedFyId = null)}>ทุกปี</button>
					{#each data.fiscalYears as fy}
						<button class="rounded-md px-3 py-1 text-[0.75rem] font-medium transition-colors"
							style="color: {selectedFyId === fy.id ? 'oklch(0.42 0.14 240)' : 'oklch(0.5 0.02 180)'}; background: {selectedFyId === fy.id ? 'oklch(0.52 0.14 240 / 0.08)' : 'transparent'}"
							onclick={() => (selectedFyId = fy.id)}>
							{fy.year_name}
							{#if fy.is_active}<span class="ml-0.5 inline-block h-1.5 w-1.5 rounded-full" style="background: oklch(0.54 0.16 150);"></span>{/if}
						</button>
					{/each}
				</div>
			{/if}
			{#if activeTab === 'dika'}
				<div class="ml-auto flex items-center gap-3">
					<span class="text-[0.8125rem]" style="color: oklch(0.5 0.02 180);">{fyFilteredDika.length} รายการ</span>
					<button onclick={exportDika} class="csv-export-btn">
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
						ส่งออก CSV
					</button>
				</div>
			{:else if activeTab === 'tax'}
				<div class="ml-auto flex items-center gap-3">
					<span class="text-[0.8125rem]" style="color: oklch(0.5 0.02 180);">{fyFilteredTax.length} รายการ</span>
					<button onclick={exportTax} class="csv-export-btn">
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
						ส่งออก CSV
					</button>
				</div>
			{:else if activeTab === 'loans'}
				<span class="ml-auto text-[0.8125rem]" style="color: oklch(0.5 0.02 180);">{filteredLoans.length} รายการ</span>
			{/if}
		</div>
	{/if}

	{#if activeTab === 'dika'}
		<!-- งานของฉัน -->
		{#if myDikaTasks.length > 0}
			<div class="mt-1.5 rounded-xl p-4" style="background: oklch(0.52 0.14 240 / 0.04); border: 1px solid oklch(0.52 0.14 240 / 0.12);">
				<div class="flex items-center gap-2 mb-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full" style="background: oklch(0.52 0.14 240); color: white;">
						<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" /></svg>
					</div>
					<h3 class="text-sm font-semibold" style="color: oklch(0.3 0.02 180);">งานของฉัน</h3>
					<span class="rounded-full px-2 py-0.5 text-xs font-semibold" style="background: oklch(0.52 0.14 240); color: white;">{myDikaTasks.length}</span>
				</div>
				<div class="space-y-2">
					{#each myDikaTasks as task}
						<button class="my-task-card" onclick={() => { selectedDika = task; payAccountId = String(task.payment_bank_account_id || ''); payTaxAccountId = String(task.tax_pool_account_id || ''); }}>
							<div class="flex items-center gap-3 flex-1 min-w-0">
								{#if task.status === 'PENDING_EXAMINE'}
									<div class="task-icon" style="background: oklch(0.62 0.18 60 / 0.12); color: oklch(0.48 0.14 60);">
										<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
									</div>
									<div class="flex-1 min-w-0">
										<p class="task-title">ตรวจสอบฎีกา #{task.id}</p>
										<p class="task-sub">{task.vendor_name} — {formatNumber(task.net_amount)} บาท</p>
									</div>
									<span class="task-badge" style="background: oklch(0.62 0.18 60 / 0.1); color: oklch(0.48 0.14 60);">รอตรวจสอบ</span>
								{:else if task.status === 'EXAMINED'}
									<div class="task-icon" style="background: oklch(0.52 0.14 240 / 0.12); color: oklch(0.42 0.12 240);">
										<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></svg>
									</div>
									<div class="flex-1 min-w-0">
										<p class="task-title">อนุมัติเบิกจ่าย #{task.id}</p>
										<p class="task-sub">{task.vendor_name} — {formatNumber(task.net_amount)} บาท</p>
									</div>
									<span class="task-badge" style="background: oklch(0.52 0.14 240 / 0.1); color: oklch(0.42 0.12 240);">รออนุมัติ</span>
								{:else if task.status === 'APPROVED'}
									<div class="task-icon" style="background: oklch(0.54 0.16 150 / 0.12); color: oklch(0.38 0.14 150);">
										<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd" /></svg>
									</div>
									<div class="flex-1 min-w-0">
										<p class="task-title">จ่ายเงินและตัดบัญชี #{task.id}</p>
										<p class="task-sub">{task.vendor_name} — {formatNumber(task.net_amount)} บาท</p>
									</div>
									<span class="task-badge" style="background: oklch(0.54 0.16 150 / 0.1); color: oklch(0.38 0.14 150);">รอจ่ายเงิน</span>
								{/if}
							</div>
							<svg class="h-4 w-4 shrink-0" style="color: oklch(0.6 0.02 180);" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="mt-1.5 overflow-hidden rounded-xl border bg-white shadow-sm">
			<table class="w-full text-left text-sm">
				<thead class="border-b bg-gray-50">
					<tr>
						<th class="px-4 py-3 font-medium text-gray-600">#</th>
						<th class="px-4 py-3 font-medium text-gray-600">ผู้รับจ้าง</th>
						<th class="px-4 py-3 font-medium text-gray-600">แผนงาน</th>
						<th class="px-4 py-3 font-medium text-gray-600 text-right">ยอดสุทธิ (บาท)</th>
						<th class="px-4 py-3 font-medium text-gray-600">ขั้นตอน</th>
						<th class="px-4 py-3 font-medium text-gray-600">จัดการ</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each paginatedDika as dika}
						<tr class="hover:bg-gray-50 cursor-pointer" onclick={() => { selectedDika = dika; payAccountId = String(dika.payment_bank_account_id || ''); payTaxAccountId = String(dika.tax_pool_account_id || ''); }}>
							<td class="px-4 py-3 font-mono text-gray-500">{dika.id}</td>
							<td class="px-4 py-3">{dika.vendor_name}</td>
							<td class="px-4 py-3 text-sm">{dika.plan_title}</td>
							<td class="px-4 py-3 text-right font-mono">{formatNumber(dika.net_amount)}</td>
							<td class="px-4 py-3">
								{#if dika.status === 'PENDING_EXAMINE'}
									<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style="background: oklch(0.62 0.18 60 / 0.1); color: oklch(0.48 0.14 60);">
										<span class="inline-block h-1.5 w-1.5 rounded-full" style="background: oklch(0.62 0.18 60);"></span>
										1. รอตรวจสอบ
									</span>
								{:else if dika.status === 'EXAMINED'}
									<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style="background: oklch(0.52 0.14 240 / 0.1); color: oklch(0.42 0.12 240);">
										<span class="inline-block h-1.5 w-1.5 rounded-full" style="background: oklch(0.52 0.14 240);"></span>
										2. รออนุมัติ
									</span>
								{:else if dika.status === 'APPROVED'}
									<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style="background: oklch(0.54 0.16 150 / 0.1); color: oklch(0.38 0.14 150);">
										<span class="inline-block h-1.5 w-1.5 rounded-full" style="background: oklch(0.54 0.16 150);"></span>
										3. รอจ่ายเงิน
									</span>
								{:else}
									<StatusBadge status={dika.status} />
								{/if}
							</td>
							<td class="px-4 py-3">
								<button onclick={() => { selectedDika = dika; payAccountId = String(dika.payment_bank_account_id || ''); payTaxAccountId = String(dika.tax_pool_account_id || ''); }}
									class="rounded px-2 py-1 text-xs font-medium" style="color: oklch(0.42 0.12 240); background: oklch(0.52 0.14 240 / 0.06);">
									ดูรายละเอียด
								</button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="px-4 py-8 text-center text-gray-500">ไม่มีฎีกาเบิกจ่าย</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<Pagination totalItems={fyFilteredDika.length} bind:currentPage={dikaPage} {perPage} />
		</div>
	{/if}

	{#if activeTab === 'accounts'}
		{#if canManageFinance}
			<div class="mt-4 flex items-center gap-2 justify-end flex-wrap">
				<button onclick={() => (showAccountTypeModal = true)} class="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50" style="border-color: oklch(0.82 0.015 180);">จัดการประเภทบัญชี</button>
				<button onclick={() => (showAccountImportModal = true)} class="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50" style="border-color: oklch(0.82 0.015 180);">นำเข้า CSV</button>
				<button onclick={() => (showCreateAccountModal = true)}
					class="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
					style="background: oklch(0.52 0.14 240);">
					+ เพิ่มบัญชีธนาคาร
				</button>
			</div>
		{/if}
		<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
			{#each data.bankAccounts as account}
				{@const bankInfo = getBankLogo(account.bank_code)}
				<div class="rounded-xl border bg-white p-5 shadow-sm" style="{bankInfo ? `border-left: 3px solid ${bankInfo.color}` : ''}">
					<div class="flex items-center gap-3">
						{#if bankInfo?.icon}
							<img src={bankInfo.icon} alt={account.bank_name} class="bank-logo" />
						{:else if account.bank_logo}
							<img src={account.bank_logo} alt={account.bank_name} class="bank-logo" />
						{:else}
							<div class="bank-logo-fallback">{account.bank_code}</div>
						{/if}
						<div class="flex-1 min-w-0">
							<h3 class="font-medium text-gray-900">{account.account_name}</h3>
							<p class="text-sm text-gray-500">{account.bank_name} | {account.account_number}</p>
						</div>
						<div class="flex items-center gap-2 flex-shrink-0">
							{#if account.account_type_name}
								<span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{account.account_type_name}</span>
							{/if}
							{#if account.is_tax_pool}
								<span class="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">บัญชีภาษี</span>
							{/if}
						</div>
					</div>
					<p class="mt-3 text-2xl font-bold text-gray-900">
						{formatBaht(account.balance)}
					</p>
				</div>
			{:else}
				<div class="col-span-2 rounded-xl border bg-white p-8 text-center text-gray-500">
					ไม่มีบัญชีธนาคาร
				</div>
			{/each}
		</div>
	{/if}

	{#if activeTab === 'loans'}
		<div class="mt-1.5 flex items-center gap-3">
			<select bind:value={loanTypeFilter}
				class="rounded-md border px-2.5 py-1 text-[0.75rem] outline-none" style="border-color: oklch(0.82 0.015 180);">
				<option value="">ทุกประเภท</option>
				<option value="TAX_POOL">ยืมจากภาษี (Tax Pool)</option>
				<option value="INTER_AGENCY">ยืมจากหน่วยงานอื่น</option>
			</select>
			{#if canManageFinance}
				<button onclick={() => (showCreateLoanModal = true)}
					class="ml-auto rounded-md px-3 py-1 text-[0.75rem] font-medium text-white"
					style="background: oklch(0.52 0.14 240);">
					+ สร้างคำขอยืมเงิน
				</button>
			{/if}
		</div>
		<div class="mt-1.5 overflow-hidden rounded-xl border bg-white shadow-sm">
			<table class="w-full text-left text-sm">
				<thead class="border-b bg-gray-50">
					<tr>
						<th class="px-4 py-3 font-medium text-gray-600">#</th>
						<th class="px-4 py-3 font-medium text-gray-600">ประเภท</th>
						<th class="px-4 py-3 font-medium text-gray-600">วัตถุประสงค์</th>
						<th class="px-4 py-3 font-medium text-gray-600 text-right">จำนวนเงิน</th>
						<th class="px-4 py-3 font-medium text-gray-600 text-right">ชำระคืนแล้ว</th>
						<th class="px-4 py-3 font-medium text-gray-600">กำหนดคืน</th>
						<th class="px-4 py-3 font-medium text-gray-600">สถานะ</th>
						<th class="px-4 py-3 font-medium text-gray-600">จัดการ</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each paginatedLoans as loan}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 font-mono text-gray-500">{loan.id}</td>
							<td class="px-4 py-3">
								{#if loan.loan_type === 'TAX_POOL'}
									<span class="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">ยืมจากภาษี</span>
								{:else}
									<span class="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">ยืมข้ามหน่วยงาน</span>
								{/if}
							</td>
							<td class="px-4 py-3">{loan.purpose}</td>
							<td class="px-4 py-3 text-right font-mono">{formatNumber(loan.amount)}</td>
							<td class="px-4 py-3 text-right font-mono">{formatNumber(loan.repaid_amount)}</td>
							<td class="px-4 py-3">{loan.due_date || '-'}</td>
							<td class="px-4 py-3"><StatusBadge status={loan.status} /></td>
							<td class="px-4 py-3">
								{#if loan.status === 'PENDING' && canManageFinance}
									<div class="flex gap-1">
										<form method="POST" action="?/approveLoan" use:enhance={() => { return async ({ update }) => { await update(); }; }}>
											<input type="hidden" name="loan_id" value={loan.id} />
											<button type="submit" name="action" value="APPROVED" class="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50">อนุมัติ</button>
										</form>
										<form method="POST" action="?/approveLoan" use:enhance={() => { return async ({ update }) => { await update(); }; }}>
											<input type="hidden" name="loan_id" value={loan.id} />
											<button type="submit" name="action" value="REJECTED" class="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">ปฏิเสธ</button>
										</form>
									</div>
								{:else if loan.status === 'APPROVED' && canManageFinance}
									<form method="POST" action="?/repayLoan" use:enhance={() => { return async ({ update }) => { await update(); }; }} class="flex items-center gap-1">
										<input type="hidden" name="loan_id" value={loan.id} />
										<input type="number" name="repay_amount" required min="1" step="0.01"
											placeholder="จำนวน" class="w-24 rounded border px-2 py-1 text-xs" />
										<button type="submit" class="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">ชำระ</button>
									</form>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="8" class="px-4 py-8 text-center text-gray-500">ไม่มีรายการยืมเงิน</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<Pagination totalItems={filteredLoans.length} bind:currentPage={loanPage} {perPage} />
		</div>
	{/if}

	{#if activeTab === 'vendors'}
		<div class="mt-4 flex items-center gap-3 flex-wrap">
			<div class="relative flex-1" style="max-width: 18rem">
				<svg class="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/></svg>
				<input type="text" placeholder="ค้นหาชื่อหรือเลขผู้เสียภาษี..."
					bind:value={vendorSearch}
					class="w-full rounded-lg border px-3 py-1.5 pl-8 text-sm outline-none" style="border-color: oklch(0.82 0.015 180);" />
			</div>
			<select bind:value={vendorTypeFilter}
				class="rounded-lg border px-3 py-1.5 text-sm outline-none" style="border-color: oklch(0.82 0.015 180);">
				<option value="">ทุกประเภท</option>
				{#each data.vendorTypes as vt}
					<option value={String(vt.id)}>{vt.name}</option>
				{/each}
			</select>
			<span class="text-sm text-gray-500">{filteredVendors.length} รายการ</span>
			{#if canManageVendors}
				<div class="ml-auto flex gap-2">
					<button onclick={() => (showVendorTypeModal = true)} class="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50" style="border-color: oklch(0.82 0.015 180);">จัดการประเภท</button>
					<button onclick={() => (showVendorImportModal = true)} class="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50" style="border-color: oklch(0.82 0.015 180);">นำเข้า CSV</button>
					<button onclick={() => (showVendorModal = true)} class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">เพิ่มผู้ประกอบการ</button>
				</div>
			{/if}
		</div>
		<div class="mt-2 overflow-hidden rounded-xl border bg-white shadow-sm">
			<table class="w-full text-left text-sm">
				<thead class="border-b bg-gray-50">
					<tr>
						<th class="px-4 py-3 font-medium text-gray-600">#</th>
						<th class="px-4 py-3 font-medium text-gray-600">ชื่อบริษัท/ร้านค้า</th>
						<th class="px-4 py-3 font-medium text-gray-600">ประเภท</th>
						<th class="px-4 py-3 font-medium text-gray-600">เลขผู้เสียภาษี</th>
						<th class="px-4 py-3 font-medium text-gray-600">ผู้ติดต่อ</th>
						<th class="px-4 py-3 font-medium text-gray-600">เบอร์โทร</th>
						<th class="px-4 py-3 font-medium text-gray-600">อีเมล</th>
						{#if canManageVendors}
							<th class="px-4 py-3 font-medium text-gray-600">จัดการ</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each paginatedVendors as v}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 font-mono text-gray-500">{v.id}</td>
							<td class="px-4 py-3 font-medium text-gray-900">{v.company_name}</td>
							<td class="px-4 py-3">
								{#if v.vendor_type_name}
									<span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{v.vendor_type_name}</span>
								{:else if v.vendor_type}
									<span class="rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">{v.vendor_type}</span>
								{:else}
									<span class="text-gray-400">-</span>
								{/if}
							</td>
							<td class="px-4 py-3 font-mono">{v.tax_id}</td>
							<td class="px-4 py-3">{v.contact_person || '-'}</td>
							<td class="px-4 py-3">{v.contact_phone || '-'}</td>
							<td class="px-4 py-3">{v.contact_email || '-'}</td>
							{#if canManageVendors}
								<td class="px-4 py-3">
									<div class="flex gap-1">
										<button onclick={() => (editingVendor = v)} class="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">แก้ไข</button>
										{#if data.user.is_super_admin}
											<form method="POST" action="?/deleteVendor" use:enhance style="display:inline;">
												<input type="hidden" name="id" value={v.id} />
												<button type="submit" class="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" onclick={(e) => swalConfirmDelete(e, v.company_name)}>ลบ</button>
											</form>
										{/if}
									</div>
								</td>
							{/if}
						</tr>
					{:else}
						<tr>
							<td colspan={canManageVendors ? 8 : 7} class="px-4 py-8 text-center text-gray-500">ไม่พบผู้ประกอบการ</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<Pagination totalItems={filteredVendors.length} bind:currentPage={vendorPage} {perPage} />
		</div>
	{/if}

	{#if activeTab === 'tax'}
		<div class="mt-1.5 overflow-hidden rounded-xl border bg-white shadow-sm">
			<table class="w-full text-left text-sm">
				<thead class="border-b bg-gray-50">
					<tr>
						<th class="px-4 py-3 font-medium text-gray-600">เลขผู้เสียภาษี</th>
						<th class="px-4 py-3 font-medium text-gray-600">แบบ</th>
						<th class="px-4 py-3 font-medium text-gray-600 text-right">ฐานภาษี (บาท)</th>
						<th class="px-4 py-3 font-medium text-gray-600 text-right">ภาษี (บาท)</th>
						<th class="px-4 py-3 font-medium text-gray-600">สถานะ</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each paginatedTax as tax}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 font-mono">{tax.tax_id}</td>
							<td class="px-4 py-3">{tax.tax_form_type}</td>
							<td class="px-4 py-3 text-right font-mono">{formatNumber(tax.tax_base_amount)}</td>
							<td class="px-4 py-3 text-right font-mono">{formatNumber(tax.tax_amount)}</td>
							<td class="px-4 py-3">
								<StatusBadge status={tax.status} />
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="px-4 py-8 text-center text-gray-500">ไม่มีข้อมูลภาษี</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<Pagination totalItems={fyFilteredTax.length} bind:currentPage={taxPage} {perPage} />
		</div>
	{/if}
</div>

<!-- Dika Detail Modal -->
{#if selectedDika}
	{@const d = selectedDika}
	{@const isFinanceStaff = canManageFinance && !isDirectorOnly}
	{@const isDirector = canApprove}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px);" onclick={() => (selectedDika = null)}>
		<div class="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" style="animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1); max-height: 90vh; overflow-y: auto;" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="flex items-center justify-between border-b px-6 py-4" style="border-color: oklch(0.92 0.005 180);">
				<div>
					<h2 class="text-lg font-semibold" style="color: oklch(0.2 0.02 180);">ฎีกาเบิกจ่าย #{d.id}</h2>
					<p class="mt-0.5 text-sm" style="color: oklch(0.5 0.02 180);">{d.plan_title}</p>
				</div>
				<button onclick={() => (selectedDika = null)} class="rounded-lg p-1.5" style="color: oklch(0.5 0.02 180);" aria-label="ปิด">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>

			<!-- Progress Steps -->
			<div class="flex items-center justify-between px-6 py-4" style="background: oklch(0.98 0.005 180);">
				{#each [
					{ label: 'วางฎีกา', status: 'PENDING_EXAMINE', done: ['PENDING_EXAMINE','EXAMINED','APPROVED','PAID'].includes(d.status) },
					{ label: 'ตรวจสอบ', status: 'EXAMINED', done: ['EXAMINED','APPROVED','PAID'].includes(d.status) },
					{ label: 'อนุมัติ', status: 'APPROVED', done: ['APPROVED','PAID'].includes(d.status) },
					{ label: 'จ่ายเงิน', status: 'PAID', done: d.status === 'PAID' }
				] as step, i}
					<div class="flex items-center gap-2">
						<div class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
							style="background: {step.done ? 'oklch(0.54 0.16 150)' : d.status === 'REJECTED' ? 'oklch(0.58 0.2 25 / 0.15)' : 'oklch(0.92 0.005 180)'}; color: {step.done ? 'white' : 'oklch(0.5 0.02 180)'};">
							{#if step.done}
								<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></svg>
							{:else}
								{i + 1}
							{/if}
						</div>
						<span class="text-xs font-medium" style="color: {step.done ? 'oklch(0.38 0.14 150)' : 'oklch(0.5 0.02 180)'};">{step.label}</span>
					</div>
					{#if i < 3}
						<div class="flex-1 h-px mx-2" style="background: {step.done ? 'oklch(0.54 0.16 150)' : 'oklch(0.88 0.01 180)'};"></div>
					{/if}
				{/each}
			</div>

			<!-- Details -->
			<div class="px-6 py-4 space-y-3">
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-lg p-3" style="background: oklch(0.98 0.005 180);">
						<p class="text-[0.6875rem] font-medium" style="color: oklch(0.5 0.02 180);">ผู้รับจ้าง</p>
						<p class="mt-0.5 text-sm font-semibold" style="color: oklch(0.25 0.02 180);">{d.vendor_name}</p>
						<p class="text-xs" style="color: oklch(0.5 0.02 180);">เลขภาษี: {d.vendor_tax_id}</p>
					</div>
					<div class="rounded-lg p-3" style="background: oklch(0.98 0.005 180);">
						<p class="text-[0.6875rem] font-medium" style="color: oklch(0.5 0.02 180);">เอกสารจัดซื้อจัดจ้าง</p>
						<a href="/procurement/{d.document_id}" class="mt-0.5 text-sm font-semibold" style="color: oklch(0.42 0.12 240);">เอกสาร #{d.document_id}</a>
					</div>
				</div>

				<div class="grid grid-cols-4 gap-2">
					<div class="rounded-lg p-3 text-center" style="background: oklch(0.52 0.14 240 / 0.05);">
						<p class="text-[0.6875rem] font-medium" style="color: oklch(0.5 0.02 180);">ยอดเต็ม</p>
						<p class="mt-0.5 text-sm font-bold tabular-nums" style="color: oklch(0.25 0.02 180);">{formatNumber(d.gross_amount)}</p>
					</div>
					<div class="rounded-lg p-3 text-center" style="background: oklch(0.62 0.18 60 / 0.05);">
						<p class="text-[0.6875rem] font-medium" style="color: oklch(0.5 0.02 180);">ค่าปรับ</p>
						<p class="mt-0.5 text-sm font-bold tabular-nums" style="color: oklch(0.48 0.14 60);">{formatNumber(d.fine_amount)}</p>
					</div>
					<div class="rounded-lg p-3 text-center" style="background: oklch(0.58 0.2 25 / 0.05);">
						<p class="text-[0.6875rem] font-medium" style="color: oklch(0.5 0.02 180);">ภาษีหัก</p>
						<p class="mt-0.5 text-sm font-bold tabular-nums" style="color: oklch(0.45 0.18 25);">{formatNumber(d.tax_amount)}</p>
					</div>
					<div class="rounded-lg p-3 text-center" style="background: oklch(0.54 0.16 150 / 0.05);">
						<p class="text-[0.6875rem] font-medium" style="color: oklch(0.5 0.02 180);">ยอดสุทธิ</p>
						<p class="mt-0.5 text-sm font-bold tabular-nums" style="color: oklch(0.38 0.14 150);">{formatNumber(d.net_amount)}</p>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="border-t px-6 py-4" style="border-color: oklch(0.92 0.005 180);">
				{#if d.status === 'PENDING_EXAMINE' && isFinanceStaff}
					<p class="mb-3 text-sm font-medium" style="color: oklch(0.35 0.02 180);">ตรวจสอบฎีกาและเอกสารประกอบ</p>
					<p class="mb-3 text-xs" style="color: oklch(0.5 0.02 180);">ตรวจลายมือชื่อ, หนี้ผูกพัน, เงินงบประมาณ, เอกสารประกอบ — หากไม่ถูกต้องแจ้งแก้ไขภายใน 3 วันทำการ</p>
					<div class="flex gap-2">
						<form method="POST" action="?/approveDika" use:enhance={() => { return async ({ result, update }) => { selectedDika = null; if (result.type === 'success') decrementFinance(); await update(); }; }}>
							<input type="hidden" name="dika_id" value={d.id} />
							<button type="submit" name="action" value="examine" class="rounded-lg px-4 py-2 text-sm font-medium text-white" style="background: oklch(0.52 0.14 240);">ตรวจสอบเสร็จสิ้น</button>
						</form>
						<form method="POST" action="?/approveDika" use:enhance={() => { return async ({ result, update }) => { selectedDika = null; if (result.type === 'success') decrementFinance(); await update(); }; }}>
							<input type="hidden" name="dika_id" value={d.id} />
							<button type="submit" name="action" value="reject" class="rounded-lg border px-4 py-2 text-sm font-medium" style="color: oklch(0.45 0.18 25); border-color: oklch(0.58 0.2 25 / 0.3);">คืนแก้ไข</button>
						</form>
					</div>

				{:else if d.status === 'EXAMINED' && isDirector}
					<p class="mb-3 text-sm font-medium" style="color: oklch(0.35 0.02 180);">พิจารณาอนุมัติการเบิกจ่าย</p>
					<p class="mb-3 text-xs" style="color: oklch(0.5 0.02 180);">เสนอฎีกาตามลำดับชั้นเพื่อพิจารณาอนุมัติ</p>
					<div class="flex gap-2">
						<form method="POST" action="?/approveDika" use:enhance={() => { return async ({ result, update }) => { selectedDika = null; if (result.type === 'success') decrementFinance(); await update(); }; }}>
							<input type="hidden" name="dika_id" value={d.id} />
							<button type="submit" name="action" value="approve" class="rounded-lg px-4 py-2 text-sm font-medium text-white" style="background: oklch(0.54 0.16 150);">อนุมัติเบิกจ่าย</button>
						</form>
						<form method="POST" action="?/approveDika" use:enhance={() => { return async ({ result, update }) => { selectedDika = null; if (result.type === 'success') decrementFinance(); await update(); }; }}>
							<input type="hidden" name="dika_id" value={d.id} />
							<button type="submit" name="action" value="reject" class="rounded-lg border px-4 py-2 text-sm font-medium" style="color: oklch(0.45 0.18 25); border-color: oklch(0.58 0.2 25 / 0.3);">ปฏิเสธ</button>
						</form>
					</div>

				{:else if d.status === 'APPROVED' && isFinanceStaff}
					<p class="mb-3 text-sm font-medium" style="color: oklch(0.35 0.02 180);">จ่ายเงิน หักภาษี และตัดบัญชี</p>
					<form method="POST" action="?/approveDika" use:enhance={() => { return async ({ result, update }) => { selectedDika = null; if (result.type === 'success') decrementFinance(); await update(); }; }} class="space-y-3">
						<input type="hidden" name="dika_id" value={d.id} />
						<input type="hidden" name="action" value="pay" />
						<div class="grid grid-cols-2 gap-3">
							<div>
								<!-- svelte-ignore a11y_label_has_associated_control -->
								<label class="mb-1 block text-xs font-medium" style="color: oklch(0.35 0.02 180);">บัญชีตัดเงิน</label>
								<CustomSelect
									options={data.bankAccounts.filter((a) => !a.is_tax_pool).map((a) => ({ value: String(a.id), label: `${a.account_name} (${a.account_number})` }))}
									name="payment_bank_account_id"
									required={true}
									bind:value={payAccountId}
									placeholder="-- เลือกบัญชี --"
									class="w-full"
								/>
							</div>
							<div>
								<!-- svelte-ignore a11y_label_has_associated_control -->
								<label class="mb-1 block text-xs font-medium" style="color: oklch(0.35 0.02 180);">บัญชีเก็บภาษีหัก</label>
								<CustomSelect
									options={[{ value: '', label: '-- ไม่มี --' }, ...data.bankAccounts.filter((a) => a.is_tax_pool).map((a) => ({ value: String(a.id), label: `${a.account_name} (${a.account_number})` }))]}
									name="tax_pool_account_id"
									bind:value={payTaxAccountId}
									placeholder="-- เลือกบัญชีภาษี --"
									class="w-full"
								/>
							</div>
						</div>
						<button type="submit" class="rounded-lg px-4 py-2 text-sm font-medium text-white" style="background: oklch(0.54 0.16 150);">ยืนยันจ่ายเงินและตัดบัญชี</button>
					</form>

				{:else if d.status === 'PAID'}
					<div class="flex items-center gap-2 rounded-lg p-3" style="background: oklch(0.54 0.16 150 / 0.06);">
						<svg class="h-5 w-5" style="color: oklch(0.54 0.16 150);" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></svg>
						<span class="text-sm font-medium" style="color: oklch(0.38 0.14 150);">จ่ายเงินและตัดบัญชีเรียบร้อยแล้ว</span>
					</div>

				{:else if d.status === 'REJECTED'}
					<div class="flex items-center gap-2 rounded-lg p-3" style="background: oklch(0.58 0.2 25 / 0.06);">
						<svg class="h-5 w-5" style="color: oklch(0.58 0.2 25);" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.28 3.22a.75.75 0 00-1.06 1.06L8.94 10l-5.72 5.72a.75.75 0 101.06 1.06L10 11.06l5.72 5.72a.75.75 0 101.06-1.06L11.06 10l5.72-5.72a.75.75 0 00-1.06-1.06L10 8.94 4.28 3.22z" clip-rule="evenodd" /></svg>
						<span class="text-sm font-medium" style="color: oklch(0.45 0.18 25);">ฎีกาถูกปฏิเสธ/คืนแก้ไข</span>
					</div>

				{:else}
					<p class="text-sm" style="color: oklch(0.5 0.02 180);">คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Create Bank Account Modal -->
{#if showCreateAccountModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px);" onclick={() => (showCreateAccountModal = false)}>
		<div class="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl" style="animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);" onclick={(e) => e.stopPropagation()}>
			<h2 class="mb-5 text-lg font-semibold" style="color: oklch(0.2 0.02 180);">เพิ่มบัญชีธนาคาร</h2>
			<form method="POST" action="?/createBankAccount" use:enhance={() => {
				return async ({ result, update }) => { showCreateAccountModal = false; await update(); };
			}}>
				<input type="hidden" name="agency_id" value={data.selectedAgencyId || ''} />
				<div class="space-y-4">
					<div>
						<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">ธนาคาร</label>
						<CustomSelect
							options={data.banks.map((b: any) => ({ value: String(b.id), label: `${b.name} (${b.bank_code})` }))}
							name="bank_id"
							required={true}
							placeholder="-- เลือกธนาคาร --"
							class="w-full"
						/>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">ประเภทบัญชี</label>
						<CustomSelect
							options={(data.bankAccountTypes ?? []).map((t: any) => ({ value: String(t.id), label: t.name }))}
							name="account_type_id"
							placeholder="-- ไม่ระบุ --"
							class="w-full"
						/>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">ชื่อบัญชี</label>
						<input name="account_name" required class="w-full rounded-lg border px-3 py-2 text-sm" style="border-color: oklch(0.82 0.015 180);" placeholder="เช่น บัญชีเงินบำรุง" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">เลขที่บัญชี</label>
						<input name="account_number" required
							pattern="[\d\-\s]{10,20}"
							title="เลขที่บัญชีต้องเป็นตัวเลข 10-15 หลัก (อาจมีขีดคั่นได้)"
							class="w-full rounded-lg border px-3 py-2 text-sm" style="border-color: oklch(0.82 0.015 180);"
							placeholder="เช่น 020-2-12345-6"
							oninput={(e) => {
								const input = e.currentTarget;
								const digits = input.value.replace(/[^0-9\-\s]/g, '');
								if (digits !== input.value) input.value = digits;
								const pure = digits.replace(/[-\s]/g, '');
								if (pure.length < 10 || pure.length > 15) {
									input.setCustomValidity('เลขที่บัญชีต้องเป็นตัวเลข 10-15 หลัก');
								} else {
									input.setCustomValidity('');
								}
							}} />
					</div>
					<div>
						<label class="flex items-center gap-2 text-sm" style="color: oklch(0.35 0.02 180);">
							<input type="checkbox" name="is_tax_pool" value="true" />
							บัญชีพักหักภาษี
						</label>
					</div>
				</div>
				<div class="mt-6 flex justify-end gap-3">
					<button type="button" onclick={() => (showCreateAccountModal = false)} class="rounded-lg px-4 py-2 text-sm" style="color: oklch(0.45 0.02 180);">ยกเลิก</button>
					<button type="submit" class="rounded-lg px-4 py-2 text-sm font-medium text-white" style="background: oklch(0.52 0.14 240);">สร้างบัญชี</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Create Loan Modal -->
{#if showCreateLoanModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px);" onclick={() => (showCreateLoanModal = false)}>
		<div class="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl" style="animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);" onclick={(e) => e.stopPropagation()}>
			<h2 class="mb-5 text-lg font-semibold" style="color: oklch(0.2 0.02 180);">สร้างคำขอยืมเงิน</h2>
			<form method="POST" action="?/createLoan" use:enhance={() => {
				return async ({ result, update }) => { showCreateLoanModal = false; selectedLoanType = ''; await update(); };
			}}>
				<input type="hidden" name="borrower_agency_id" value={data.selectedAgencyId || ''} />
				<div class="space-y-4">
					<div>
						<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">ประเภทการยืม</label>
						<CustomSelect
							options={[
								{ value: 'TAX_POOL', label: 'ยืมจากเงินภาษี (Tax Pool)' },
								{ value: 'INTER_AGENCY', label: 'ยืมจากหน่วยงานอื่น' }
							]}
							name="loan_type"
							required={true}
							placeholder="-- เลือกประเภท --"
							bind:value={selectedLoanType}
							class="w-full"
						/>
					</div>
					{#if selectedLoanType === 'TAX_POOL'}
						<div>
							<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">บัญชีพักภาษี</label>
							<CustomSelect
								options={data.bankAccounts.filter((a: any) => a.is_tax_pool).map((a: any) => ({ value: String(a.id), label: `${a.account_name} (${a.account_number}) - ${formatBaht(a.balance)}` }))}
								name="source_bank_account_id"
								placeholder="-- เลือกบัญชีภาษี --"
								class="w-full"
							/>
						</div>
					{/if}
					{#if selectedLoanType === 'INTER_AGENCY'}
						<div>
							<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">หน่วยงานที่ยืม</label>
							<CustomSelect
								options={data.allAgencies.filter((a: any) => a.id !== data.selectedAgencyId).map((a: any) => ({ value: String(a.id), label: a.name }))}
								name="lender_agency_id"
								required={true}
								placeholder="-- เลือกหน่วยงาน --"
								class="w-full"
							/>
						</div>
					{/if}
					<div>
						<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">จำนวนเงิน (บาท)</label>
						<input name="amount" type="number" required min="1" step="0.01"
							class="w-full rounded-lg border px-3 py-2 text-sm" style="border-color: oklch(0.82 0.015 180);"
							placeholder="0.00" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">วัตถุประสงค์</label>
						<textarea name="purpose" required rows="2"
							class="w-full rounded-lg border px-3 py-2 text-sm" style="border-color: oklch(0.82 0.015 180);"
							placeholder="ระบุเหตุผลการยืมเงิน"></textarea>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium" style="color: oklch(0.35 0.02 180);">กำหนดคืน (ถ้ามี)</label>
						<CustomDatePicker name="due_date" class="w-full" />
					</div>
				</div>
				<div class="mt-6 flex justify-end gap-3">
					<button type="button" onclick={() => (showCreateLoanModal = false)} class="rounded-lg px-4 py-2 text-sm" style="color: oklch(0.45 0.02 180);">ยกเลิก</button>
					<button type="submit" class="rounded-lg px-4 py-2 text-sm font-medium text-white" style="background: oklch(0.52 0.14 240);">ส่งคำขอ</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	/* My Tasks */
	.my-task-card {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 14px;
		border-radius: 10px;
		border: 1px solid oklch(0.92 0.005 180);
		background: oklch(0.995 0.002 180);
		cursor: pointer;
		text-align: left;
		font-family: 'Noto Sans Thai', system-ui, sans-serif;
		transition: background 0.15s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.my-task-card:hover {
		background: oklch(0.52 0.14 240 / 0.03);
		border-color: oklch(0.52 0.14 240 / 0.2);
		box-shadow: 0 2px 8px oklch(0.52 0.14 240 / 0.06);
	}
	.task-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		flex-shrink: 0;
	}
	.task-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: oklch(0.25 0.02 180);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.task-sub {
		font-size: 0.75rem;
		color: oklch(0.5 0.02 180);
		margin: 2px 0 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.task-badge {
		font-size: 0.6875rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 6px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.csv-export-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 10px;
		border: 1px solid oklch(0.88 0.01 180);
		background: oklch(0.98 0.005 180);
		font-family: 'Noto Sans Thai', system-ui, sans-serif;
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.35 0.02 180);
		cursor: pointer;
		transition: background 0.15s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.csv-export-btn:hover {
		background: oklch(0.52 0.14 240 / 0.04);
		border-color: oklch(0.52 0.14 240 / 0.3);
		box-shadow: 0 1px 3px oklch(0.52 0.14 240 / 0.08);
	}
	.csv-export-btn svg {
		color: oklch(0.52 0.14 240);
	}
	@keyframes scale-in { from { opacity: 0; } to { opacity: 1; } }
	.bank-logo {
		width: 36px;
		height: 36px;
		object-fit: contain;
		border-radius: 8px;
		flex-shrink: 0;
	}
	.bank-logo-fallback {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		background: #e3f2fd;
		color: #1565c0;
		font-size: 0.625rem;
		font-weight: 700;
		flex-shrink: 0;
	}
</style>

<!-- Vendor Create Modal -->
{#if showVendorModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
			<h2 class="text-lg font-bold text-gray-900">เพิ่มผู้ประกอบการ</h2>
			<form method="POST" action="?/createVendor" use:enhance={() => {
				return async ({ update }) => { showVendorModal = false; await update(); };
			}}>
				<div class="mt-4 space-y-3">
					<div>
						<label class="block text-sm font-medium text-gray-700">ชื่อบริษัท/ร้านค้า <span class="text-red-500">*</span></label>
						<input name="company_name" required class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="block text-sm font-medium text-gray-700">เลขผู้เสียภาษี <span class="text-red-500">*</span></label>
							<input name="tax_id" required maxlength="13" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">ประเภท</label>
							<select name="vendor_type_id" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
								<option value="">-- ไม่ระบุ --</option>
								{#each data.vendorTypes as vt}
									<option value={vt.id}>{vt.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">ผู้ติดต่อ</label>
						<input name="contact_person" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="block text-sm font-medium text-gray-700">เบอร์โทร</label>
							<input name="contact_phone" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">อีเมล</label>
							<input name="contact_email" type="email" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
						</div>
					</div>
				</div>
				<div class="mt-6 flex justify-end gap-2">
					<button type="button" onclick={() => (showVendorModal = false)} class="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
					<button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">บันทึก</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Vendor Edit Modal -->
{#if editingVendor}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
			<h2 class="text-lg font-bold text-gray-900">แก้ไขผู้ประกอบการ</h2>
			<form method="POST" action="?/updateVendor" use:enhance={() => {
				return async ({ update }) => { editingVendor = null; await update(); };
			}}>
				<input type="hidden" name="id" value={editingVendor.id} />
				<div class="mt-4 space-y-3">
					<div>
						<label class="block text-sm font-medium text-gray-700">ชื่อบริษัท/ร้านค้า <span class="text-red-500">*</span></label>
						<input name="company_name" required value={editingVendor.company_name} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="block text-sm font-medium text-gray-700">เลขผู้เสียภาษี</label>
							<input value={editingVendor.tax_id} disabled class="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">ประเภท</label>
							<select name="vendor_type_id" class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
								<option value="">-- ไม่ระบุ --</option>
								{#each data.vendorTypes as vt}
									<option value={vt.id} selected={editingVendor.vendor_type_id === vt.id}>{vt.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">ผู้ติดต่อ</label>
						<input name="contact_person" value={editingVendor.contact_person || ''} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="block text-sm font-medium text-gray-700">เบอร์โทร</label>
							<input name="contact_phone" value={editingVendor.contact_phone || ''} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700">อีเมล</label>
							<input name="contact_email" type="email" value={editingVendor.contact_email || ''} class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
						</div>
					</div>
				</div>
				<div class="mt-6 flex justify-end gap-2">
					<button type="button" onclick={() => (editingVendor = null)} class="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
					<button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">บันทึก</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Vendor Type Management Modal -->
{#if showVendorTypeModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
			<h2 class="text-lg font-bold text-gray-900">จัดการประเภทผู้ประกอบการ</h2>

			<div class="mt-4 max-h-60 space-y-2 overflow-y-auto">
				{#each data.vendorTypes as vt}
					<div class="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
						<span class="text-sm">{vt.name}</span>
						{#if data.user.is_super_admin}
							<form method="POST" action="?/deleteVendorType" use:enhance style="display:inline;">
								<input type="hidden" name="id" value={vt.id} />
								<button type="submit" class="text-xs text-red-600 hover:text-red-800" onclick={(e) => swalConfirmDelete(e, vt.name)}>ลบ</button>
							</form>
						{/if}
					</div>
				{:else}
					<p class="py-4 text-center text-sm text-gray-500">ยังไม่มีประเภท</p>
				{/each}
			</div>

			<form method="POST" action="?/createVendorType" use:enhance class="mt-4 flex gap-2">
				<input name="name" required placeholder="ชื่อประเภทใหม่" class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
				<button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">เพิ่ม</button>
			</form>

			<div class="mt-4 flex justify-end">
				<button type="button" onclick={() => (showVendorTypeModal = false)} class="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">ปิด</button>
			</div>
		</div>
	</div>
{/if}

<!-- Vendor Import CSV Modal -->
{#if showVendorImportModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
			<h2 class="text-lg font-bold text-gray-900">นำเข้าผู้ประกอบการจาก CSV</h2>
			<p class="mt-1 text-sm text-gray-500">อัปโหลดไฟล์ CSV ที่มีข้อมูลผู้ประกอบการ</p>

			<div class="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
				<p class="text-xs text-gray-500 mb-2">คอลัมน์ที่รองรับ:</p>
				<p class="text-xs text-gray-600 font-mono">ชื่อบริษัท*, เลขผู้เสียภาษี*, ประเภท, ผู้ติดต่อ, เบอร์โทร, อีเมล</p>
				<p class="text-xs text-gray-400 mt-1">* = จำเป็น | เลขผู้เสียภาษีต้อง 13 หลัก ซ้ำจะถูกข้าม | ชื่อประเภทต้องตรงกับที่มีในระบบ</p>
				<button type="button" onclick={() => downloadCsvTemplate('vendors',
					['ชื่อบริษัท', 'เลขผู้เสียภาษี', 'ประเภท', 'ผู้ติดต่อ', 'เบอร์โทร', 'อีเมล'],
					[
						['บริษัท อุปกรณ์การแพทย์ จำกัด', '1234567890123', 'นิติบุคคล', 'สมชาย สุขใจ', '021234567', 'contact@medical.co.th'],
						['ร้าน เวชภัณฑ์ดี', '9876543210987', 'บุคคลธรรมดา', 'สมหญิง ดีงาม', '081234567', ''],
						['ห้างหุ้นส่วนจำกัด ไอทีซัพพลาย', '1111222233334', 'ห้างหุ้นส่วนจำกัด', '', '029876543', 'info@itsupply.co.th'],
					]
				)} class="mt-2 text-xs text-blue-600 hover:underline cursor-pointer">
					ดาวน์โหลด Template CSV
				</button>
			</div>

			<form method="POST" action="?/importVendorCsv" enctype="multipart/form-data" use:enhance={() => {
				return async ({ update }) => { showVendorImportModal = false; await update(); };
			}}>
				<div class="mt-4">
					<input name="csv_file" type="file" accept=".csv" required class="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
				</div>
				<div class="mt-6 flex justify-end gap-2">
					<button type="button" onclick={() => (showVendorImportModal = false)} class="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
					<button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">นำเข้า</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Bank Account Type Management Modal -->
{#if showAccountTypeModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
			<h2 class="text-lg font-bold text-gray-900">จัดการประเภทบัญชี</h2>

			<div class="mt-4 max-h-60 space-y-2 overflow-y-auto">
				{#each data.bankAccountTypes ?? [] as t}
					<div class="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
						<span class="text-sm">{t.name}</span>
					</div>
				{:else}
					<p class="py-4 text-center text-sm text-gray-500">ยังไม่มีประเภทบัญชี</p>
				{/each}
			</div>

			<form method="POST" action="?/createBankAccountType" use:enhance class="mt-4 flex gap-2">
				<input name="name" required placeholder="ชื่อประเภทบัญชีใหม่" class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
				<button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">เพิ่ม</button>
			</form>

			<div class="mt-4 flex justify-end">
				<button type="button" onclick={() => (showAccountTypeModal = false)} class="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">ปิด</button>
			</div>
		</div>
	</div>
{/if}

<!-- Bank Account Import CSV Modal -->
{#if showAccountImportModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
			<h2 class="text-lg font-bold text-gray-900">นำเข้าบัญชีธนาคารจาก CSV</h2>
			<p class="mt-1 text-sm text-gray-500">อัปโหลดไฟล์ CSV ที่มีข้อมูลบัญชีธนาคาร</p>

			<div class="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
				<p class="text-xs text-gray-500 mb-2">คอลัมน์ที่รองรับ:</p>
				<p class="text-xs text-gray-600 font-mono">ชื่อบัญชี*, เลขที่บัญชี*, ธนาคาร*, หน่วยงาน*, ประเภทบัญชี, บัญชีภาษี</p>
				<p class="text-xs text-gray-400 mt-1">* = จำเป็น | ชื่อธนาคาร/หน่วยงาน/ประเภทต้องตรงกับที่มีในระบบ | บัญชีภาษี: ใช่/ไม่ใช่</p>
				<button type="button" onclick={() => downloadCsvTemplate('bank-accounts',
					['ชื่อบัญชี', 'เลขที่บัญชี', 'ธนาคาร', 'หน่วยงาน', 'ประเภทบัญชี', 'บัญชีภาษี'],
					[
						['บัญชีเงินบำรุง', '020-2-12345-6', 'ธนาคารกรุงไทย', 'โรงพยาบาลร้อยเอ็ด', 'บัญชีออมทรัพย์', 'ไม่ใช่'],
						['บัญชีพักหักภาษี', '020-2-12345-7', 'ธนาคารกรุงไทย', 'โรงพยาบาลร้อยเอ็ด', 'บัญชีกระแสรายวัน', 'ใช่'],
						['บัญชีงบประมาณ', '123-4-56789-0', 'ธนาคารกรุงเทพ', 'โรงพยาบาลร้อยเอ็ด', 'บัญชีออมทรัพย์', 'ไม่ใช่'],
					]
				)} class="mt-2 text-xs text-blue-600 hover:underline cursor-pointer">
					ดาวน์โหลด Template CSV
				</button>
			</div>

			<form method="POST" action="?/importBankAccountCsv" enctype="multipart/form-data" use:enhance={() => {
				return async ({ update }) => { showAccountImportModal = false; await update(); };
			}}>
				<div class="mt-4">
					<input name="csv_file" type="file" accept=".csv" required class="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
				</div>
				<div class="mt-6 flex justify-end gap-2">
					<button type="button" onclick={() => (showAccountImportModal = false)} class="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
					<button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">นำเข้า</button>
				</div>
			</form>
		</div>
	</div>
{/if}
