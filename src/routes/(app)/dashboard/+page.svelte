<script lang="ts">
	import { formatBaht } from '$lib/utils/format';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ScopeSelector from '$lib/components/ScopeSelector.svelte';
	import { DonutChart, BarChart, KPICard, ProgressChart, HorizontalBarChart } from '$lib/components/charts';
	import { DocumentIcon, BuildingIcon, UsersIcon, PlanIcon } from '$lib/components/icons';

	let { data } = $props();
	let stats = $derived(data.stats as Record<string, any>);
	let chartData = $derived(data.chartData as Record<string, any>);
	let filters = $derived(data.filters as { provinceId: number | null; agencyId: number | null; orgUnitId: number | null });

	let hasScopeSelected = $derived(
		!data.user.is_super_admin
			? true
			: (filters.provinceId !== null && filters.agencyId !== null)
	);

	// Budget helpers
	let budgetSummary = $derived(chartData.budgetSummary as {
		income: { estimated: number; actual: number };
		expense: { estimated: number; actual: number };
	} | undefined);

	let totalEstimated = $derived(
		budgetSummary
			? budgetSummary.income.estimated + budgetSummary.expense.estimated
			: 0
	);
	let totalActual = $derived(
		budgetSummary
			? budgetSummary.income.actual + budgetSummary.expense.actual
			: 0
	);
	let totalRemaining = $derived(totalEstimated - totalActual);
	let utilizationPct = $derived(
		totalEstimated > 0 ? ((totalActual / totalEstimated) * 100).toFixed(1) : '0.0'
	);

	// Plan execution
	let planExec = $derived(stats.planExecutionRate as { total: number; started: number; percentage: string } | undefined);

	// Budget comparison helpers
	let incomePct = $derived(
		budgetSummary && budgetSummary.income.estimated > 0
			? (budgetSummary.income.actual / budgetSummary.income.estimated) * 100
			: 0
	);
	let expensePct = $derived(
		budgetSummary && budgetSummary.expense.estimated > 0
			? (budgetSummary.expense.actual / budgetSummary.expense.estimated) * 100
			: 0
	);
	let incomeDiff = $derived(
		budgetSummary ? budgetSummary.income.actual - budgetSummary.income.estimated : 0
	);
	let expenseDiff = $derived(
		budgetSummary ? budgetSummary.expense.actual - budgetSummary.expense.estimated : 0
	);
	let netBalance = $derived(
		budgetSummary
			? (budgetSummary.income.actual - budgetSummary.expense.actual)
			: 0
	);
	let maxIncome = $derived(
		budgetSummary ? Math.max(budgetSummary.income.estimated, budgetSummary.income.actual, 1) : 1
	);
	let maxExpense = $derived(
		budgetSummary ? Math.max(budgetSummary.expense.estimated, budgetSummary.expense.actual, 1) : 1
	);

	// Format helper
	function fmtBahtShort(val: number): string {
		if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
		if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
		return val.toLocaleString();
	}
</script>

<div>
	<PageHeader
		title="แดชบอร์ด"
		subtitle=""
		userName={data.user.name}
		isSuperAdmin={data.user.is_super_admin}
		isDirector={data.user.is_director}
	/>

	<!-- Scope Selector: only super admin -->
	{#if data.user.is_super_admin}
		<ScopeSelector
			provinces={data.provinces}
			agencies={data.agencies}
			orgUnits={data.orgUnits}
			selectedProvinceId={filters.provinceId}
			selectedAgencyId={filters.agencyId}
			selectedOrgUnitId={filters.orgUnitId}
			isSuperAdmin={data.user.is_super_admin}
			isDirector={false}
			compact={true}
		/>
	{/if}

	{#if hasScopeSelected}
		<!-- ═══ Agency Context Banner ═══ -->
		{#if data.selectedAgencyName}
			<div class="agency-banner">
				<div class="agency-banner-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
					</svg>
				</div>
				<div class="agency-banner-text">
					<span class="agency-banner-name">{data.selectedAgencyName}</span>
					{#if stats.fiscalYear}
						<span class="agency-banner-fy">ปีงบประมาณ {stats.fiscalYear.year_name}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- ═══ SECTION 1: KPI Cards (6 cards, 2 rows) ═══ -->
		<div class="kpi-row">
			<KPICard
				title="หน่วยงานย่อย"
				value={stats.agencyOrgUnits ?? 0}
				icon={BuildingIcon}
				color="oklch(0.52 0.14 240)"
			/>
			<KPICard
				title="บุคลากร"
				value={stats.agencyUsers ?? 0}
				icon={UsersIcon}
				color="oklch(0.54 0.16 150)"
			/>
			<KPICard
				title="แผนงานทั้งหมด"
				value={stats.totalPlans ?? 0}
				subtitle={planExec ? `ดำเนินการแล้ว ${planExec.started}/${planExec.total} (${planExec.percentage}%)` : undefined}
				icon={PlanIcon}
				color="oklch(0.55 0.12 280)"
			/>
			<KPICard
				title="เอกสารดำเนินการ"
				value={stats.activeDocuments ?? 0}
				subtitle="จากทั้งหมด {stats.totalDocuments ?? 0} | สำเร็จ {stats.completedDocuments ?? 0}"
				icon={DocumentIcon}
				color="oklch(0.52 0.14 240)"
			/>
			<KPICard
				title="ฎีการอตรวจสอบ"
				value={stats.pendingDikaVouchers ?? 0}
				subtitle="จากทั้งหมด {stats.totalDikaVouchers ?? 0} | จ่ายแล้ว {stats.paidDikaVouchers ?? 0}"
				color="oklch(0.62 0.18 60)"
			/>
			<KPICard
				title="ยอดฎีกาสุทธิ"
				value={formatBaht(stats.totalDikaNet ?? 0)}
				subtitle="ภาษี {formatBaht(stats.totalDikaTax ?? 0)}"
				color="oklch(0.54 0.16 150)"
			/>
		</div>

		<!-- ═══ SECTION 2: Budget Overview ═══ -->
		{#if budgetSummary}
			<div class="section-header">
				<h2 class="section-title">ภาพรวมงบประมาณ</h2>
			</div>
			<div class="budget-section">
				<!-- Net balance summary strip -->
				<div class="budget-net-strip">
					<div class="net-strip-item">
						<span class="net-strip-label">งบประมาณรวม</span>
						<span class="net-strip-value">{formatBaht(totalEstimated)}</span>
					</div>
					<div class="net-strip-divider"></div>
					<div class="net-strip-item">
						<span class="net-strip-label">ใช้ไปแล้ว</span>
						<span class="net-strip-value">{formatBaht(totalActual)} <span class="net-strip-pct">({utilizationPct}%)</span></span>
					</div>
					<div class="net-strip-divider"></div>
					<div class="net-strip-item">
						<span class="net-strip-label">รายรับ − รายจ่าย (จริง)</span>
						<span class="net-strip-value net-balance" class:positive={netBalance >= 0} class:negative={netBalance < 0}>
							{netBalance >= 0 ? '+' : ''}{formatBaht(netBalance)}
						</span>
					</div>
				</div>

				<!-- Comparison cards -->
				<div class="compare-grid">
					<!-- INCOME comparison -->
					<div class="compare-card">
						<div class="compare-header">
							<div class="compare-icon income-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
								</svg>
							</div>
							<div class="compare-title-group">
								<h3 class="compare-title">รายรับ</h3>
								<span class="compare-subtitle">เปรียบเทียบแผน vs จริง</span>
							</div>
							<div class="compare-badge" class:badge-over={incomePct >= 100} class:badge-under={incomePct < 100}>
								{incomePct.toFixed(1)}%
							</div>
						</div>

						<div class="compare-bars">

							<div class="bar-row">
								<span class="bar-label">แผน</span>
								<div class="bar-track">
									<div class="bar-fill plan-fill income-plan" style="width: {(budgetSummary.income.estimated / maxIncome) * 100}%;"></div>
								</div>
								<span class="bar-amount">{formatBaht(budgetSummary.income.estimated)}</span>
							</div>
							<div class="bar-row">
								<span class="bar-label">จริง</span>
								<div class="bar-track">
									<div class="bar-fill actual-fill income-actual" style="width: {(budgetSummary.income.actual / maxIncome) * 100}%;"></div>
								</div>
								<span class="bar-amount">{formatBaht(budgetSummary.income.actual)}</span>
							</div>
						</div>

						<div class="compare-footer">
							<div class="diff-indicator" class:diff-positive={incomeDiff >= 0} class:diff-negative={incomeDiff < 0}>
								<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
									{#if incomeDiff >= 0}
										<path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
									{:else}
										<path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
									{/if}
								</svg>
								<span>{incomeDiff >= 0 ? 'รับเกินแผน' : 'รับต่ำกว่าแผน'}</span>
								<strong>{formatBaht(Math.abs(incomeDiff))}</strong>
							</div>
						</div>
					</div>

					<!-- EXPENSE comparison -->
					<div class="compare-card">
						<div class="compare-header">
							<div class="compare-icon expense-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
								</svg>
							</div>
							<div class="compare-title-group">
								<h3 class="compare-title">รายจ่าย</h3>
								<span class="compare-subtitle">เปรียบเทียบแผน vs จริง</span>
							</div>
							<div class="compare-badge" class:badge-safe={expensePct <= 100} class:badge-danger={expensePct > 100}>
								{expensePct.toFixed(1)}%
							</div>
						</div>

						<div class="compare-bars">

							<div class="bar-row">
								<span class="bar-label">แผน</span>
								<div class="bar-track">
									<div class="bar-fill plan-fill expense-plan" style="width: {(budgetSummary.expense.estimated / maxExpense) * 100}%;"></div>
								</div>
								<span class="bar-amount">{formatBaht(budgetSummary.expense.estimated)}</span>
							</div>
							<div class="bar-row">
								<span class="bar-label">จริง</span>
								<div class="bar-track">
									<div class="bar-fill actual-fill expense-actual" style="width: {(budgetSummary.expense.actual / maxExpense) * 100}%;"></div>
								</div>
								<span class="bar-amount">{formatBaht(budgetSummary.expense.actual)}</span>
							</div>
						</div>

						<div class="compare-footer">
							<div class="diff-indicator" class:diff-positive={expenseDiff <= 0} class:diff-negative={expenseDiff > 0}>
								<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
									{#if expenseDiff <= 0}
										<path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
									{:else}
										<path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
									{/if}
								</svg>
								<span>{expenseDiff <= 0 ? 'ประหยัดกว่าแผน' : 'จ่ายเกินแผน'}</span>
								<strong>{formatBaht(Math.abs(expenseDiff))}</strong>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- ═══ SECTION 3: Plans & Budget Drill-down ═══ -->
		<div class="section-header">
			<h2 class="section-title">แผนงานและงบประมาณ</h2>
		</div>
		<div class="grid-2col-asymmetric">
			<!-- Top parent plans -->
			{#if chartData.topParentPlans && chartData.topParentPlans.length > 0}
				<ProgressChart
					title="แผนงานหลัก"
					subtitle="การใช้จ่ายงบประมาณตามแผนหลัก"
					items={chartData.topParentPlans}
				/>
			{/if}

			<!-- Plan type donut -->
			{#if chartData.planType && chartData.planType.length > 0}
				<div class="stack-2">
					<DonutChart
						title="สัดส่วนแผนงาน"
						subtitle="รายได้ vs รายจ่าย"
						data={chartData.planType}
					/>

					<!-- Plan execution gauge -->
					{#if planExec}
						<div class="gauge-card">
							<h3 class="gauge-title">อัตราดำเนินการแผน</h3>
							<div class="gauge-container">
								<svg viewBox="0 0 120 70" class="gauge-svg">
									<path
										d="M 10 65 A 50 50 0 0 1 110 65"
										fill="none"
										stroke="oklch(0.92 0.005 180)"
										stroke-width="10"
										stroke-linecap="round"
									/>
									<path
										d="M 10 65 A 50 50 0 0 1 110 65"
										fill="none"
										stroke="oklch(0.54 0.16 150)"
										stroke-width="10"
										stroke-linecap="round"
										stroke-dasharray="{Number(planExec.percentage) / 100 * 157} 157"
										class="gauge-fill"
									/>
								</svg>
								<div class="gauge-value">{planExec.percentage}%</div>
							</div>
							<div class="gauge-meta">
								<span>{planExec.started} จาก {planExec.total} แผนงาน</span>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Budget by org unit — split income/expense -->
		{#if (chartData.budgetByUnitIncome && chartData.budgetByUnitIncome.length > 0) || (chartData.budgetByUnitExpense && chartData.budgetByUnitExpense.length > 0)}
			<div class="grid-2col">
				{#if chartData.budgetByUnitIncome && chartData.budgetByUnitIncome.length > 0}
					<ProgressChart
						title="งบประมาณรายรับแยกตามหน่วยงาน"
						subtitle="หน่วยงานที่มีรายรับสูงสุด"
						items={chartData.budgetByUnitIncome}
					/>
				{/if}
				{#if chartData.budgetByUnitExpense && chartData.budgetByUnitExpense.length > 0}
					<ProgressChart
						title="งบประมาณรายจ่ายแยกตามหน่วยงาน"
						subtitle="หน่วยงานที่มีรายจ่ายสูงสุด"
						items={chartData.budgetByUnitExpense}
					/>
				{/if}
			</div>
		{/if}

		<!-- ═══ SECTION 4: Documents & Procurement ═══ -->
		<div class="section-header">
			<h2 class="section-title">เอกสารและจัดซื้อจัดจ้าง</h2>
		</div>
		<div class="grid-3col">
			{#if chartData.documentStatus && chartData.documentStatus.length > 0}
				<DonutChart
					title="สถานะเอกสาร"
					subtitle="แยกตามสถานะปัจจุบัน"
					data={chartData.documentStatus}
				/>
			{/if}

			{#if chartData.docsByWorkflow && chartData.docsByWorkflow.length > 0}
				<BarChart
					title="เอกสารตามวิธีจัดซื้อ"
					subtitle="จำนวนเอกสารแต่ละวิธี"
					data={chartData.docsByWorkflow}
				/>
			{/if}

			{#if chartData.approvalStats && chartData.approvalStats.length > 0}
				<DonutChart
					title="ผลการอนุมัติ"
					subtitle="อัตราอนุมัติ vs ไม่อนุมัติ"
					data={chartData.approvalStats}
				/>
			{/if}
		</div>

		<!-- ═══ SECTION 5: Finance & Dika Vouchers ═══ -->
		<div class="section-header">
			<h2 class="section-title">การเงินและฎีกา</h2>
		</div>
		<div class="grid-2col">
			{#if chartData.dikaStatus && chartData.dikaStatus.length > 0}
				<DonutChart
					title="สถานะฎีกา"
					subtitle="ภาพรวมสถานะฎีกาทั้งหมด"
					data={chartData.dikaStatus}
				/>
			{/if}

			<!-- Dika amounts table -->
			{#if chartData.dikaAmounts && chartData.dikaAmounts.length > 0}
				<div class="table-card">
					<h3 class="table-title">ยอดเงินฎีกาแยกตามสถานะ</h3>
					<p class="table-subtitle">สรุปยอดเงินรวม ภาษี และยอดสุทธิ</p>
					<div class="table-wrap">
						<table class="data-table">
							<thead>
								<tr>
									<th>สถานะ</th>
									<th class="num">จำนวน</th>
									<th class="num">ยอดรวม</th>
									<th class="num">ภาษี</th>
									<th class="num">สุทธิ</th>
								</tr>
							</thead>
							<tbody>
								{#each chartData.dikaAmounts as item}
									<tr>
										<td>
											<span class="status-dot" style="background: {item.color};"></span>
											{item.label}
										</td>
										<td class="num">{item.count}</td>
										<td class="num">{fmtBahtShort(item.grossAmount)}</td>
										<td class="num">{fmtBahtShort(item.taxAmount)}</td>
										<td class="num font-semibold">{fmtBahtShort(item.netAmount)}</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr>
									<td class="font-semibold">รวม</td>
									<td class="num">{stats.totalDikaVouchers ?? 0}</td>
									<td class="num font-semibold">{fmtBahtShort(stats.totalDikaGross ?? 0)}</td>
									<td class="num">{fmtBahtShort(stats.totalDikaTax ?? 0)}</td>
									<td class="num font-semibold">{fmtBahtShort(stats.totalDikaNet ?? 0)}</td>
								</tr>
							</tfoot>
						</table>
					</div>
				</div>
			{/if}
		</div>

		<!-- Bank accounts + Top vendors -->
		<div class="grid-2col">
			<!-- Bank Accounts -->
			{#if chartData.bankBalances && chartData.bankBalances.length > 0}
				<div class="table-card">
					<h3 class="table-title">บัญชีธนาคาร</h3>
					<p class="table-subtitle">ยอดเงินคงเหลือในแต่ละบัญชี</p>
					<div class="bank-list">
						{#each chartData.bankBalances as account}
							<div class="bank-item">
								<div class="bank-icon" class:tax-pool={account.isTaxPool}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
										{#if account.isTaxPool}
											<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
										{:else}
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
										{/if}
									</svg>
								</div>
								<div class="bank-info">
									<span class="bank-name">{account.name}</span>
									<span class="bank-number">{account.number}</span>
								</div>
								<div class="bank-balance" class:tax-pool-balance={account.isTaxPool}>
									{formatBaht(account.balance)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Top Vendors -->
			{#if chartData.topVendors && chartData.topVendors.length > 0}
				<HorizontalBarChart
					title="คู่ค้าที่มียอดสูงสุด"
					subtitle="จัดอันดับตามยอดฎีการวม"
					items={chartData.topVendors.map((v: any) => ({
						label: v.name,
						value: v.amount,
						sublabel: `${v.count} รายการ · ${v.type}`,
					}))}
					formatValue={(v) => fmtBahtShort(v)}
				/>
			{/if}
		</div>

		<!-- ═══ SECTION 6: Human Resources ═══ -->
		{#if chartData.staffByRole && chartData.staffByRole.length > 0}
			<div class="section-header">
				<h2 class="section-title">บุคลากร</h2>
			</div>
			<div class="grid-full">
				<BarChart
					title="การกระจายบุคลากรตามตำแหน่ง"
					subtitle="จำนวนบุคลากรในแต่ละบทบาท"
					data={chartData.staffByRole}
				/>
			</div>
		{/if}

	{:else}
		<!-- Empty State -->
		<div class="empty-state">
			<div class="empty-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<h3 class="empty-title">เลือกขอบเขตเพื่อดูข้อมูล</h3>
			<p class="empty-description">
				กรุณาเลือกจังหวัดและหน่วยงานด้านบนเพื่อดูข้อมูลเชิงลึก
			</p>
			<div class="empty-hint">
				<div class="hint-step">
					<div class="hint-number">1</div>
					<span>เลือกจังหวัด</span>
				</div>
				<div class="hint-arrow">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
					</svg>
				</div>
				<div class="hint-step">
					<div class="hint-number">2</div>
					<span>เลือกหน่วยงาน</span>
				</div>
				<div class="hint-arrow">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
					</svg>
				</div>
				<div class="hint-step">
					<div class="hint-number">3</div>
					<span>ดูข้อมูลวิเคราะห์</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>

	/* ── Agency Banner ── */
	.agency-banner {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 20px;
		margin-bottom: 28px;
		border-radius: 12px;
		background: oklch(0.52 0.14 240 / 0.06);
		border-left: 3px solid oklch(0.52 0.14 240);
		animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.agency-banner-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: oklch(0.52 0.14 240);
	}

	.agency-banner-icon svg {
		width: 24px;
		height: 24px;
	}

	.agency-banner-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.agency-banner-name {
		font-size: clamp(0.9375rem, 0.8rem + 0.35vw, 1.0625rem);
		font-weight: 600;
		color: oklch(0.25 0.02 180);
	}

	.agency-banner-fy {
		font-size: 0.8125rem;
		color: oklch(0.5 0.02 180);
	}

	/* ── Section Headers ── */
	.section-header {
		margin-top: 44px;
		margin-bottom: 20px;
		padding-bottom: 12px;
		border-bottom: 1px solid oklch(0.92 0.005 180);
	}

	.section-title {
		margin: 0;
		font-size: clamp(1.0625rem, 0.9rem + 0.4vw, 1.1875rem);
		font-weight: 600;
		color: oklch(0.25 0.02 180);
		letter-spacing: -0.01em;
	}

	/* ── KPI Row ── */
	.kpi-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
		margin-bottom: 8px;
	}

	/* ── Grid Layouts ── */
	.grid-2col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		margin-bottom: 8px;
	}

	.grid-2col-asymmetric {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 24px;
		margin-bottom: 8px;
	}

	.grid-3col {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
		margin-bottom: 8px;
	}

	.grid-full {
		margin-bottom: 8px;
	}

	.full-width-card {
		margin-bottom: 8px;
	}

	.stack-2 {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* ── Budget Section ── */
	.budget-section {
		margin-bottom: 8px;
		animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* Net balance summary strip */
	.budget-net-strip {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 18px 28px;
		background: oklch(0.98 0.005 180);
		border: 1px solid oklch(0.9 0.005 180);
		border-radius: 14px;
		margin-bottom: 20px;
	}

	.net-strip-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.net-strip-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: oklch(0.5 0.02 180);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.net-strip-value {
		font-size: clamp(1.0625rem, 0.9rem + 0.4vw, 1.3125rem);
		font-weight: 700;
		color: oklch(0.25 0.02 180);
		font-variant-numeric: tabular-nums;
	}

	.net-strip-pct {
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.5 0.02 180);
	}

	.net-strip-divider {
		width: 1px;
		height: 40px;
		background: oklch(0.88 0.01 180);
		margin: 0 24px;
		flex-shrink: 0;
	}

	.net-balance.positive {
		color: oklch(0.48 0.16 150);
	}

	.net-balance.negative {
		color: oklch(0.5 0.2 25);
	}

	/* Comparison grid */
	.compare-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
	}

	.compare-card {
		background: oklch(0.995 0.002 180);
		border: 1px solid oklch(0.9 0.005 180);
		border-radius: 16px;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 24px;
		animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
	}

	.compare-card:nth-child(2) {
		animation-delay: 0.08s;
	}

	.compare-header {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.compare-icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.compare-icon svg {
		width: 22px;
		height: 22px;
	}

	.income-icon {
		background: oklch(0.54 0.16 150 / 0.1);
		color: oklch(0.48 0.16 150);
	}

	.expense-icon {
		background: oklch(0.52 0.14 240 / 0.1);
		color: oklch(0.52 0.14 240);
	}

	.compare-title-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.compare-title {
		margin: 0;
		font-size: clamp(1rem, 0.85rem + 0.4vw, 1.125rem);
		font-weight: 600;
		color: oklch(0.25 0.02 180);
	}

	.compare-subtitle {
		font-size: 0.75rem;
		color: oklch(0.55 0.02 180);
	}

	.compare-badge {
		padding: 5px 12px;
		border-radius: 20px;
		font-size: 0.875rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.badge-over {
		background: oklch(0.54 0.16 150 / 0.12);
		color: oklch(0.42 0.14 150);
	}

	.badge-under {
		background: oklch(0.62 0.18 60 / 0.12);
		color: oklch(0.5 0.16 60);
	}

	.badge-safe {
		background: oklch(0.54 0.16 150 / 0.12);
		color: oklch(0.42 0.14 150);
	}

	.badge-danger {
		background: oklch(0.5 0.2 25 / 0.12);
		color: oklch(0.45 0.18 25);
	}

	/* Comparison bars */
	.compare-bars {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.bar-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.bar-label {
		width: 32px;
		font-size: 0.75rem;
		font-weight: 600;
		color: oklch(0.5 0.02 180);
		text-align: right;
		flex-shrink: 0;
	}

	.bar-track {
		flex: 1;
		height: 28px;
		background: oklch(0.95 0.005 180);
		border-radius: 6px;
		overflow: hidden;
		position: relative;
	}

	.bar-fill {
		height: 100%;
		border-radius: 6px;
		animation: grow-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) backwards;
		min-width: 2px;
	}

	.plan-fill {
		opacity: 0.35;
	}

	.actual-fill {
		opacity: 1;
	}

	.income-plan,
	.income-actual {
		background: oklch(0.54 0.16 150);
	}

	.expense-plan,
	.expense-actual {
		background: oklch(0.52 0.14 240);
	}

	.bar-amount {
		width: clamp(90px, 10vw, 130px);
		font-size: 0.8125rem;
		font-weight: 600;
		color: oklch(0.3 0.02 180);
		text-align: right;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	/* Difference footer */
	.compare-footer {
		padding-top: 16px;
		border-top: 1px solid oklch(0.93 0.005 180);
	}

	.diff-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.8125rem;
		padding: 8px 14px;
		border-radius: 10px;
	}

	.diff-indicator span {
		color: oklch(0.45 0.02 180);
	}

	.diff-indicator strong {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.diff-positive {
		background: oklch(0.54 0.16 150 / 0.06);
		color: oklch(0.42 0.14 150);
	}

	.diff-positive strong {
		color: oklch(0.42 0.14 150);
	}

	.diff-negative {
		background: oklch(0.5 0.2 25 / 0.06);
		color: oklch(0.45 0.18 25);
	}

	.diff-negative strong {
		color: oklch(0.45 0.18 25);
	}

	/* ── Gauge Card ── */
	.gauge-card {
		background: oklch(0.995 0.002 180);
		border: 1px solid oklch(0.9 0.005 180);
		border-radius: 16px;
		padding: 24px;
		text-align: center;
	}

	.gauge-title {
		margin: 0 0 16px 0;
		font-size: clamp(1rem, 0.85rem + 0.4vw, 1.125rem);
		font-weight: 600;
		color: oklch(0.25 0.02 180);
	}

	.gauge-container {
		position: relative;
		width: 160px;
		height: 90px;
		margin: 0 auto 12px;
	}

	.gauge-svg {
		width: 100%;
		height: 100%;
	}

	.gauge-fill {
		animation: gauge-animate 1s cubic-bezier(0.16, 1, 0.3, 1) backwards;
	}

	.gauge-value {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		font-size: 1.5rem;
		font-weight: 700;
		color: oklch(0.54 0.16 150);
	}

	.gauge-meta {
		font-size: 0.8125rem;
		color: oklch(0.5 0.02 180);
	}

	/* ── Table Card ── */
	.table-card {
		background: oklch(0.995 0.002 180);
		border: 1px solid oklch(0.9 0.005 180);
		border-radius: 16px;
		padding: 24px;
		animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.table-title {
		margin: 0 0 4px 0;
		font-size: clamp(1rem, 0.85rem + 0.4vw, 1.125rem);
		font-weight: 600;
		color: oklch(0.25 0.02 180);
	}

	.table-subtitle {
		margin: 0 0 20px 0;
		font-size: 0.8125rem;
		color: oklch(0.5 0.02 180);
	}

	.table-wrap {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.data-table th {
		text-align: left;
		padding: 8px 12px;
		font-weight: 500;
		color: oklch(0.45 0.02 180);
		border-bottom: 1px solid oklch(0.9 0.005 180);
		font-size: 0.8125rem;
	}

	.data-table td {
		padding: 10px 12px;
		color: oklch(0.3 0.02 180);
		border-bottom: 1px solid oklch(0.95 0.003 180);
	}

	.data-table tfoot td {
		border-bottom: none;
		border-top: 2px solid oklch(0.88 0.01 180);
		color: oklch(0.25 0.02 180);
	}

	.data-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.font-semibold { font-weight: 600; }

	.status-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-right: 8px;
		vertical-align: middle;
	}

	/* ── Bank List ── */
	.bank-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.bank-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: 12px;
		background: oklch(0.98 0.005 180);
		border: 1px solid oklch(0.92 0.005 180);
		transition: transform 0.2s ease;
	}

	.bank-item:hover {
		transform: translateY(-1px);
	}

	.bank-icon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: oklch(0.52 0.14 240 / 0.1);
		color: oklch(0.52 0.14 240);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.bank-icon svg {
		width: 20px;
		height: 20px;
	}

	.bank-icon.tax-pool {
		background: oklch(0.62 0.18 60 / 0.1);
		color: oklch(0.62 0.18 60);
	}

	.bank-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.bank-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: oklch(0.25 0.02 180);
	}

	.bank-number {
		font-size: 0.75rem;
		color: oklch(0.55 0.02 180);
		font-variant-numeric: tabular-nums;
	}

	.bank-balance {
		font-size: 0.9375rem;
		font-weight: 700;
		color: oklch(0.52 0.14 240);
		white-space: nowrap;
	}

	.bank-balance.tax-pool-balance {
		color: oklch(0.62 0.18 60);
	}

	/* ── Empty State ── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 32px;
		text-align: center;
		animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.empty-icon {
		width: 80px;
		height: 80px;
		margin-bottom: 24px;
		border-radius: 50%;
		background: oklch(0.52 0.14 240 / 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.empty-icon svg {
		width: 40px;
		height: 40px;
		color: oklch(0.52 0.14 240);
	}

	.empty-title {
		margin: 0 0 12px 0;
		font-size: clamp(1.25rem, 1rem + 0.6vw, 1.5rem);
		font-weight: 600;
		color: oklch(0.25 0.02 180);
	}

	.empty-description {
		max-width: 400px;
		margin: 0 0 32px 0;
		font-size: 0.9375rem;
		color: oklch(0.5 0.02 180);
		line-height: 1.6;
	}

	.empty-hint {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.hint-step {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-radius: 12px;
		background: oklch(0.98 0.005 180);
		border: 1px solid oklch(0.9 0.005 180);
		font-size: 0.875rem;
		color: oklch(0.35 0.02 180);
	}

	.hint-number {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: oklch(0.52 0.14 240);
		color: oklch(0.98 0.005 180);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.hint-arrow {
		color: oklch(0.6 0.02 180);
		display: flex;
		align-items: center;
	}

	/* ── Animations ── */
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes grow-right {
		from { width: 0 !important; opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes gauge-animate {
		from { stroke-dasharray: 0 157; }
	}

	/* ── Responsive ── */
	@media (max-width: 1024px) {
		.kpi-row {
			grid-template-columns: repeat(2, 1fr);
		}

		.grid-2col,
		.grid-2col-asymmetric {
			grid-template-columns: 1fr;
		}

		.grid-3col {
			grid-template-columns: 1fr 1fr;
		}

		.compare-grid {
			grid-template-columns: 1fr;
		}

		.budget-net-strip {
			flex-wrap: wrap;
			gap: 16px;
		}

		.net-strip-divider {
			display: none;
		}

		.net-strip-item {
			min-width: 140px;
		}
	}

	@media (max-width: 640px) {
		.kpi-row {
			grid-template-columns: 1fr;
		}

		.grid-3col {
			grid-template-columns: 1fr;
		}

		.budget-net-strip {
			padding: 16px 20px;
		}

		.bar-amount {
			width: 80px;
			font-size: 0.75rem;
		}

		.empty-hint {
			flex-direction: column;
		}

		.hint-arrow {
			transform: rotate(90deg);
		}
	}
</style>
