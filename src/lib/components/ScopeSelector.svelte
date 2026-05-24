<script lang="ts">
	import { goto } from '$app/navigation';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import type { Province, Agency, OrgUnit } from '$lib/types/dashboard';

	interface Props {
		provinces: Province[];
		agencies: Agency[];
		orgUnits: OrgUnit[];
		selectedProvinceId?: number | null;
		selectedAgencyId?: number | null;
		selectedOrgUnitId?: number | null;
		isSuperAdmin?: boolean;
		isDirector?: boolean;
		basePath?: string;
		compact?: boolean;
	}

	let {
		provinces,
		agencies,
		orgUnits,
		selectedProvinceId = null,
		selectedAgencyId = null,
		selectedOrgUnitId = null,
		isSuperAdmin = false,
		isDirector = false,
		basePath = '/dashboard',
		compact = false
	}: Props = $props();

	let provinceId = $state(selectedProvinceId);
	let agencyId = $state(selectedAgencyId);
	let orgUnitId = $state(selectedOrgUnitId);

	let filteredAgencies = $derived(
		provinceId
			? agencies.filter((a) => a.province_id === provinceId)
			: agencies
	);

	let filteredOrgUnits = $derived(
		agencyId
			? orgUnits.filter((o) => o.agency_id === agencyId)
			: orgUnits
	);

	async function saveScope() {
		const form = new FormData();
		form.set('province_id', provinceId ? String(provinceId) : '');
		form.set('agency_id', agencyId ? String(agencyId) : '');
		await fetch('/org-management?/selectScope', { method: 'POST', body: form });
		// Reload current page to pick up new cookie values
		location.reload();
	}

	function handleProvinceChange(val: string) {
		provinceId = val ? parseInt(val) : null;
		agencyId = null;
		orgUnitId = null;
		saveScope();
	}

	function handleAgencyChange(val: string) {
		agencyId = val ? parseInt(val) : null;
		orgUnitId = null;
		saveScope();
	}

	function handleOrgUnitChange(val: string) {
		orgUnitId = val ? parseInt(val) : null;
	}

	let provinceOptions = $derived(
		provinces.map((p) => ({ value: String(p.id), label: p.name }))
	);

	let agencyOptions = $derived(
		filteredAgencies.map((a) => ({ value: String(a.id), label: a.name }))
	);

	let orgUnitOptions = $derived(
		filteredOrgUnits.map((o) => ({ value: String(o.id), label: o.name }))
	);

	// Director doesn't need scope selector — auto-selected by server
	let showSelector = $derived(!isDirector);
	// Super admin only needs province + agency (no sub-org unit)
	let showOrgUnit = $derived(!isSuperAdmin && !isDirector);
</script>

{#if showSelector}
	<div class="scope-selector" class:compact>
		{#if !compact}
			<div class="scope-header">
				<h2 class="scope-title">เลือกขอบเขตข้อมูล</h2>
				<p class="scope-subtitle">เลือกจังหวัดและหน่วยงานเพื่อดูข้อมูลเชิงลึก</p>
			</div>
		{/if}

		<div class="scope-fields" class:two-cols={!showOrgUnit}>
			<div class="field-group">
				<label for="province" class="field-label">จังหวัด</label>
				<CustomSelect
					id="province"
					class="field-select"
					options={provinceOptions}
					value={provinceId ? String(provinceId) : ''}
					placeholder="-- เลือกจังหวัด --"
					onchange={handleProvinceChange}
				/>
			</div>

			<div class="field-group">
				<label for="agency" class="field-label">หน่วยงาน</label>
				<CustomSelect
					id="agency"
					class="field-select"
					options={agencyOptions}
					value={agencyId ? String(agencyId) : ''}
					placeholder="-- เลือกหน่วยงาน --"
					onchange={handleAgencyChange}
					disabled={!provinceId}
				/>
			</div>

			{#if showOrgUnit}
				<div class="field-group">
					<label for="orgUnit" class="field-label">หน่วยงานย่อย</label>
					<CustomSelect
						id="orgUnit"
						class="field-select"
						options={orgUnitOptions}
						value={orgUnitId ? String(orgUnitId) : ''}
						placeholder="-- เลือกหน่วยงานย่อย --"
						onchange={handleOrgUnitChange}
						disabled={!agencyId}
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.scope-selector {
		background: oklch(0.98 0.005 180);
		border: 1px solid oklch(0.88 0.01 180);
		border-radius: 16px;
		padding: 24px;
		margin-bottom: 32px;
		animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.scope-selector.compact {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 18px;
		margin-bottom: 16px;
		border-radius: 12px;
	}
	.compact .scope-fields {
		display: flex;
		gap: 12px;
		flex: 1;
	}
	.compact .scope-fields.two-cols {
		grid-template-columns: none;
	}
	.compact .field-group {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}
	.compact .field-label {
		white-space: nowrap;
		font-size: 0.8125rem;
	}

	.scope-header {
		margin-bottom: 20px;
	}

	.scope-title {
		font-size: clamp(1.125rem, 0.9rem + 0.5vw, 1.25rem);
		font-weight: 600;
		color: oklch(0.25 0.02 180);
		margin: 0 0 4px 0;
	}

	.scope-subtitle {
		font-size: 0.875rem;
		color: oklch(0.5 0.02 180);
		margin: 0;
	}

	.scope-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.scope-fields.two-cols {
		grid-template-columns: 1fr 1fr;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.35 0.02 180);
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

	@media (max-width: 640px) {
		.scope-fields.two-cols {
			grid-template-columns: 1fr;
		}
	}
</style>
