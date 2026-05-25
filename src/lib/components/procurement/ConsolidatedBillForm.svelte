<script lang="ts">
	import BillSectionAccordion from './BillSectionAccordion.svelte';
	import CommitteeSelector from './CommitteeSelector.svelte';
	import VendorQuotationList from './VendorQuotationList.svelte';
	import { BILL_SECTION_LABELS } from '$lib/types/procurement';

	let {
		procurementMethod,
		billPayload = {},
		users = [],
		vendors = [],
		roundId,
		readonly = false,
		onsave,
		onsubmit
	}: {
		procurementMethod: string;
		billPayload: Record<string, any>;
		users: { id: number; name: string; position?: string }[];
		vendors: { id: number; company_name: string; tax_id: string }[];
		roundId: number;
		readonly?: boolean;
		onsave: (payload: Record<string, any>) => void;
		onsubmit: (payload: Record<string, any>) => void;
	} = $props();

	// Local state for the bill data
	let data = $state<Record<string, any>>({ ...billPayload });

	// Get sections for this method
	let sectionLabels = $derived(BILL_SECTION_LABELS[procurementMethod] ?? {});
	let sectionKeys = $derived(Object.keys(sectionLabels));

	function getSectionStatus(key: string): 'empty' | 'partial' | 'complete' {
		const section = data[key];
		if (!section) return 'empty';
		if (typeof section !== 'object') return 'partial';
		const values = Object.values(section);
		if (values.length === 0) return 'empty';
		const filled = values.filter(v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0));
		if (filled.length === 0) return 'empty';
		if (filled.length === values.length) return 'complete';
		return 'partial';
	}

	function updateSection(key: string, value: any) {
		data = { ...data, [key]: value };
	}

	function handleSave() {
		onsave(data);
	}

	function handleSubmit() {
		onsubmit(data);
	}

	// Section type detection
	function isCommitteeSection(key: string): boolean {
		return ['tor', 'median_price', 'procurement_committee', 'inspection'].includes(key);
	}

	function isVendorSection(key: string): boolean {
		return ['quotations', 'vendor_proposals', 'invitation'].includes(key);
	}

	let completedCount = $derived(sectionKeys.filter(k => getSectionStatus(k) === 'complete').length);
	let allComplete = $derived(completedCount === sectionKeys.length);
</script>

<div>
	<!-- Header -->
	<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px">
		<div>
			<h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: oklch(0.25 0.02 180)">เอกสารจัดซื้อจัดจ้าง</h3>
			<p style="margin: 2px 0 0; font-size: 0.75rem; color: oklch(0.55 0.02 180)">
				กรอกครบ {completedCount}/{sectionKeys.length} ส่วน
			</p>
		</div>
		<!-- Progress bar -->
		<div style="width: 120px; height: 6px; border-radius: 3px; background: oklch(0.92 0.005 180); overflow: hidden">
			<div style="width: {sectionKeys.length > 0 ? (completedCount / sectionKeys.length * 100) : 0}%; height: 100%; border-radius: 3px; background: oklch(0.54 0.16 150); transition: width 0.3s ease"></div>
		</div>
	</div>

	<!-- Sections -->
	{#each sectionKeys as key}
		<BillSectionAccordion
			title={sectionLabels[key]}
			sectionKey={key}
			status={getSectionStatus(key)}
		>
			{#if key === 'tor'}
				<!-- TOR Section -->
				<div style="display: flex; flex-direction: column; gap: 12px">
					<div>
						<label style="display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)">รายละเอียด TOR</label>
						<textarea
							value={data.tor?.description ?? ''}
							onchange={(e) => updateSection('tor', { ...data.tor, description: e.currentTarget.value })}
							rows="4"
							disabled={readonly}
							style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; resize: vertical; outline: none; font-family: 'Noto Sans Thai', sans-serif"
							placeholder="ระบุรายละเอียด TOR..."
						></textarea>
					</div>
					{#if procurementMethod !== 'e_market'}
						<CommitteeSelector
							committeeType="TOR"
							{users}
							selected={data.tor?.committee ?? []}
							onchange={(members) => updateSection('tor', { ...data.tor, committee: members })}
						/>
					{/if}
				</div>

			{:else if key === 'median_price'}
				<!-- Median Price Section -->
				<div style="display: flex; flex-direction: column; gap: 12px">
					<CommitteeSelector
						committeeType="ราคากลาง"
						{users}
						selected={data.median_price?.committee ?? []}
						onchange={(members) => updateSection('median_price', { ...data.median_price, committee: members })}
					/>
				</div>

			{:else if key === 'quotations'}
				<!-- Quotations Section -->
				<VendorQuotationList
					{vendors}
					quotations={data.quotations?.items ?? []}
					winnerId={data.vendor_selection?.winner_vendor_id ?? null}
					onchange={({ quotations: q, winner_vendor_id }) => {
						updateSection('quotations', { items: q });
						if (winner_vendor_id !== undefined) {
							updateSection('vendor_selection', { ...data.vendor_selection, winner_vendor_id });
						}
					}}
				/>

			{:else if key === 'vendor_selection'}
				<!-- Vendor Selection (auto-linked from quotations winner) -->
				<div>
					<label style="display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)">เหตุผลในการเลือก</label>
					<textarea
						value={data.vendor_selection?.reason ?? ''}
						onchange={(e) => updateSection('vendor_selection', { ...data.vendor_selection, reason: e.currentTarget.value })}
						rows="2"
						disabled={readonly}
						style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; resize: vertical; outline: none; font-family: 'Noto Sans Thai', sans-serif"
						placeholder="ระบุเหตุผล..."
					></textarea>
					{#if data.vendor_selection?.winner_vendor_id}
						<p style="margin: 6px 0 0; font-size: 0.75rem; color: oklch(0.38 0.14 150)">
							ผู้ชนะ: {vendors.find(v => v.id === data.vendor_selection.winner_vendor_id)?.company_name ?? 'ไม่ระบุ'}
						</p>
					{/if}
				</div>

			{:else if key === 'procurement_committee'}
				<!-- Procurement Committee -->
				<CommitteeSelector
					committeeType="จัดซื้อจัดจ้าง"
					{users}
					selected={data.procurement_committee?.committee ?? []}
					onchange={(members) => updateSection('procurement_committee', { ...data.procurement_committee, committee: members })}
				/>

			{:else if key === 'invitation'}
				<!-- Invitation Letters -->
				<VendorQuotationList
					{vendors}
					quotations={data.invitation?.vendors?.map((vid: number) => ({ vendor_id: vid, price: '' })) ?? []}
					winnerId={null}
					onchange={({ quotations: q }) => {
						updateSection('invitation', { vendors: q.map((qi: any) => qi.vendor_id) });
					}}
				/>

			{:else if key === 'vendor_proposals'}
				<!-- Vendor Proposals (e-Bidding) -->
				<VendorQuotationList
					{vendors}
					quotations={data.vendor_proposals?.items ?? []}
					winnerId={data.vendor_selection?.winner_vendor_id ?? null}
					onchange={({ quotations: q, winner_vendor_id }) => {
						updateSection('vendor_proposals', { items: q });
						if (winner_vendor_id !== undefined) {
							updateSection('vendor_selection', { ...data.vendor_selection, winner_vendor_id });
						}
					}}
				/>

			{:else if key === 'evaluation'}
				<!-- Evaluation -->
				<div>
					<label style="display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)">ผลการประเมิน</label>
					<textarea
						value={data.evaluation?.notes ?? ''}
						onchange={(e) => updateSection('evaluation', { ...data.evaluation, notes: e.currentTarget.value })}
						rows="3"
						disabled={readonly}
						style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; resize: vertical; outline: none; font-family: 'Noto Sans Thai', sans-serif"
						placeholder="ระบุผลการประเมิน..."
					></textarea>
				</div>

			{:else if key === 'announcement'}
				<!-- Announcement (e-Bidding) -->
				<div style="display: flex; flex-direction: column; gap: 10px">
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)">เริ่มรับฟังวิจารณ์</label>
							<input type="date" value={data.announcement?.comment_period_start ?? ''}
								onchange={(e) => updateSection('announcement', { ...data.announcement, comment_period_start: e.currentTarget.value })}
								disabled={readonly}
								style="width: 100%; padding: 7px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; font-family: 'Noto Sans Thai', sans-serif" />
						</div>
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)">สิ้นสุดรับฟังวิจารณ์</label>
							<input type="date" value={data.announcement?.comment_period_end ?? ''}
								onchange={(e) => updateSection('announcement', { ...data.announcement, comment_period_end: e.currentTarget.value })}
								disabled={readonly}
								style="width: 100%; padding: 7px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; font-family: 'Noto Sans Thai', sans-serif" />
						</div>
					</div>
				</div>

			{:else if key === 'winner_announcement'}
				<!-- Winner Announcement -->
				<div>
					<label style="display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)">หมายเหตุ</label>
					<textarea
						value={data.winner_announcement?.notes ?? ''}
						onchange={(e) => updateSection('winner_announcement', { ...data.winner_announcement, notes: e.currentTarget.value })}
						rows="2" disabled={readonly}
						style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; resize: vertical; outline: none; font-family: 'Noto Sans Thai', sans-serif"
						placeholder="หมายเหตุเพิ่มเติม..."
					></textarea>
				</div>

			{:else if key === 'contract'}
				<!-- Contract -->
				<div>
					<label style="display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)">รายละเอียดสัญญา</label>
					<textarea
						value={data.contract?.details ?? ''}
						onchange={(e) => updateSection('contract', { ...data.contract, details: e.currentTarget.value })}
						rows="3" disabled={readonly}
						style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; resize: vertical; outline: none; font-family: 'Noto Sans Thai', sans-serif"
						placeholder="ระบุรายละเอียดสัญญา..."
					></textarea>
				</div>

			{:else if key === 'inspection'}
				<!-- Inspection -->
				<CommitteeSelector
					committeeType="ตรวจรับ"
					{users}
					selected={data.inspection?.committee ?? []}
					onchange={(members) => updateSection('inspection', { ...data.inspection, committee: members })}
				/>

			{:else if key === 'purchase_order'}
				<!-- Purchase Order -->
				<div>
					<label style="display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)">รายละเอียดใบสั่งซื้อ</label>
					<textarea
						value={data.purchase_order?.details ?? ''}
						onchange={(e) => updateSection('purchase_order', { ...data.purchase_order, details: e.currentTarget.value })}
						rows="2" disabled={readonly}
						style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; resize: vertical; outline: none; font-family: 'Noto Sans Thai', sans-serif"
						placeholder="ระบุรายละเอียด..."
					></textarea>
				</div>

			{:else if key === 'e_catalog'}
				<!-- e-Catalog items -->
				<div>
					<p style="margin: 0 0 6px; font-size: 0.75rem; color: oklch(0.5 0.02 180)">รายการสินค้า</p>
					{#each (data.e_catalog?.items ?? []) as item, i}
						<div style="display: grid; grid-template-columns: 1fr 80px 100px auto; gap: 6px; margin-bottom: 6px; align-items: center">
							<input value={item.name} placeholder="ชื่อสินค้า"
								onchange={(e) => { const items = [...(data.e_catalog?.items ?? [])]; items[i] = { ...items[i], name: e.currentTarget.value }; updateSection('e_catalog', { items }); }}
								style="padding: 6px 10px; border-radius: 6px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; font-family: 'Noto Sans Thai', sans-serif" />
							<input value={item.quantity} type="number" placeholder="จำนวน"
								onchange={(e) => { const items = [...(data.e_catalog?.items ?? [])]; items[i] = { ...items[i], quantity: Number(e.currentTarget.value) }; updateSection('e_catalog', { items }); }}
								style="padding: 6px 10px; border-radius: 6px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; text-align: right" />
							<input value={item.unit_price} placeholder="ราคา/หน่วย"
								onchange={(e) => { const items = [...(data.e_catalog?.items ?? [])]; items[i] = { ...items[i], unit_price: e.currentTarget.value }; updateSection('e_catalog', { items }); }}
								style="padding: 6px 10px; border-radius: 6px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; text-align: right" />
							<button type="button" onclick={() => { const items = (data.e_catalog?.items ?? []).filter((_: any, j: number) => j !== i); updateSection('e_catalog', { items }); }}
								style="width: 22px; height: 22px; border-radius: 50%; border: none; background: oklch(0.58 0.2 25 / 0.08); color: oklch(0.58 0.2 25); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem">&times;</button>
						</div>
					{/each}
					<button type="button" onclick={() => { const items = [...(data.e_catalog?.items ?? []), { name: '', quantity: 1, unit_price: '' }]; updateSection('e_catalog', { items }); }}
						style="padding: 6px 14px; border-radius: 6px; border: 1px dashed oklch(0.82 0.04 240); background: none; color: oklch(0.45 0.1 240); font-size: 0.75rem; cursor: pointer; font-family: 'Noto Sans Thai', sans-serif">+ เพิ่มรายการ</button>
				</div>

			{:else}
				<!-- Fallback: generic text area -->
				<div>
					<textarea
						value={data[key]?.notes ?? ''}
						onchange={(e) => updateSection(key, { notes: e.currentTarget.value })}
						rows="3" disabled={readonly}
						style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; resize: vertical; outline: none; font-family: 'Noto Sans Thai', sans-serif"
						placeholder="กรอกข้อมูล..."
					></textarea>
				</div>
			{/if}
		</BillSectionAccordion>
	{/each}

	<!-- Action Buttons -->
	{#if !readonly}
		<div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid oklch(0.92 0.005 180)">
			<button type="button" onclick={handleSave}
				style="padding: 10px 20px; border-radius: 10px; border: 1px solid oklch(0.88 0.01 180); background: white; color: oklch(0.35 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; font-family: 'Noto Sans Thai', sans-serif">
				บันทึกร่าง
			</button>
			<button type="button" onclick={handleSubmit} disabled={!allComplete}
				style="padding: 10px 24px; border-radius: 10px; border: none; background: oklch(0.54 0.16 150); color: white; font-size: 0.875rem; font-weight: 600; cursor: pointer; opacity: {allComplete ? '1' : '0.5'}; font-family: 'Noto Sans Thai', sans-serif">
				ส่งการเงิน
			</button>
		</div>
	{/if}
</div>
