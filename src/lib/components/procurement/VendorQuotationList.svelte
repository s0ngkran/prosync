<script lang="ts">
	let {
		vendors = [],
		quotations = [],
		winnerId = null,
		onchange
	}: {
		vendors: { id: number; company_name: string; tax_id: string }[];
		quotations: { vendor_id: number; price: string; pdf_url?: string }[];
		winnerId: number | null;
		onchange: (data: { quotations: any[]; winner_vendor_id: number | null }) => void;
	} = $props();

	let items = $state<{ vendor_id: number; price: string; pdf_url: string }[]>(
		quotations.map(q => ({ vendor_id: q.vendor_id, price: q.price, pdf_url: q.pdf_url ?? '' }))
	);
	let selectedWinner = $state<number | null>(winnerId);
	let addVendorId = $state<string>('');

	function addQuotation() {
		const vid = Number(addVendorId);
		if (!vid || items.some(i => i.vendor_id === vid)) return;
		items = [...items, { vendor_id: vid, price: '', pdf_url: '' }];
		addVendorId = '';
		emit();
	}

	function removeQuotation(vendorId: number) {
		items = items.filter(i => i.vendor_id !== vendorId);
		if (selectedWinner === vendorId) selectedWinner = null;
		emit();
	}

	function updatePrice(vendorId: number, price: string) {
		items = items.map(i => i.vendor_id === vendorId ? { ...i, price } : i);
		emit();
	}

	function selectWinner(vendorId: number) {
		selectedWinner = vendorId;
		emit();
	}

	function emit() {
		onchange({ quotations: items, winner_vendor_id: selectedWinner });
	}

	function getVendorName(id: number) {
		return vendors.find(v => v.id === id)?.company_name ?? `Vendor #${id}`;
	}

	let availableVendors = $derived(
		vendors.filter(v => !items.some(i => i.vendor_id === v.id))
	);
</script>

<div>
	<!-- Existing quotations -->
	{#if items.length > 0}
		<div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px">
			{#each items as item}
				<div style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; border: 1px solid {selectedWinner === item.vendor_id ? 'oklch(0.54 0.16 150)' : 'oklch(0.92 0.005 180)'}; background: {selectedWinner === item.vendor_id ? 'oklch(0.54 0.16 150 / 0.04)' : 'white'}">
					<!-- Winner radio -->
					<input type="radio" name="winner" checked={selectedWinner === item.vendor_id}
						onchange={() => selectWinner(item.vendor_id)}
						style="cursor: pointer" title="เลือกเป็นผู้ชนะ" />

					<!-- Vendor name -->
					<span style="flex: 1; font-size: 0.8125rem; font-weight: 500; color: oklch(0.3 0.02 180); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
						{getVendorName(item.vendor_id)}
						{#if selectedWinner === item.vendor_id}
							<span style="margin-left: 4px; font-size: 0.625rem; padding: 1px 6px; border-radius: 4px; background: oklch(0.54 0.16 150 / 0.12); color: oklch(0.38 0.14 150); font-weight: 600">ผู้ชนะ</span>
						{/if}
					</span>

					<!-- Price -->
					<input
						type="text"
						value={item.price}
						onchange={(e) => updatePrice(item.vendor_id, e.currentTarget.value)}
						placeholder="ราคา"
						style="width: 120px; padding: 5px 10px; border-radius: 6px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; text-align: right; outline: none; font-family: 'Noto Sans Thai', sans-serif"
					/>
					<span style="font-size: 0.6875rem; color: oklch(0.55 0.02 180)">บาท</span>

					<!-- Remove -->
					<button type="button" onclick={() => removeQuotation(item.vendor_id)}
						style="width: 22px; height: 22px; border-radius: 50%; border: none; background: oklch(0.58 0.2 25 / 0.08); color: oklch(0.58 0.2 25); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 10px; height: 10px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add vendor -->
	<div style="display: flex; gap: 8px">
		<select
			bind:value={addVendorId}
			style="flex: 1; padding: 7px 10px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; font-family: 'Noto Sans Thai', sans-serif"
		>
			<option value="">-- เลือกผู้ขาย --</option>
			{#each availableVendors as v}
				<option value={String(v.id)}>{v.company_name} ({v.tax_id})</option>
			{/each}
		</select>
		<button type="button" onclick={addQuotation} disabled={!addVendorId}
			style="padding: 7px 14px; border-radius: 8px; border: none; background: oklch(0.52 0.14 240); color: white; font-size: 0.75rem; font-weight: 500; cursor: pointer; white-space: nowrap; opacity: {addVendorId ? '1' : '0.5'}">
			+ เพิ่มผู้ขาย
		</button>
	</div>
</div>
