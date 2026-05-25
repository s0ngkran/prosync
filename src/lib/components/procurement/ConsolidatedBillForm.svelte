<script lang="ts">
	import BillSectionAccordion from './BillSectionAccordion.svelte';
	import CommitteeSelector from './CommitteeSelector.svelte';
	import VendorQuotationList from './VendorQuotationList.svelte';
	import { BILL_SECTION_DEFS, type BillSectionDef } from '$lib/types/procurement';

	let {
		procurementMethod,
		documentSlug,
		billPayload = {},
		users = [],
		vendors = [],
		roundId,
		readonly = false,
		onsave,
		onsubmit
	}: {
		procurementMethod: string;
		documentSlug: string;
		billPayload: Record<string, any>;
		users: { id: number; name: string; position?: string }[];
		vendors: { id: number; company_name: string; tax_id: string }[];
		roundId: number;
		readonly?: boolean;
		onsave: (payload: Record<string, any>) => void;
		onsubmit: (payload: Record<string, any>) => void;
	} = $props();

	let data = $state<Record<string, any>>({ ...billPayload });

	let sectionDefs = $derived(BILL_SECTION_DEFS[procurementMethod] ?? {});
	let sectionEntries = $derived(Object.entries(sectionDefs) as [string, BillSectionDef][]);

	// Upload state
	let uploading = $state<Record<string, boolean>>({});

	function getSectionStatus(key: string): 'empty' | 'partial' | 'complete' {
		const section = data[key];
		if (!section || typeof section !== 'object') return 'empty';
		const def = sectionDefs[key];
		if (!def) return 'empty';
		const requiredFields = def.fields.filter(f => f.required);
		if (requiredFields.length === 0) return 'complete';
		const filledRequired = requiredFields.filter(f => {
			const v = section[f.key];
			if (v === null || v === undefined || v === '') return false;
			if (Array.isArray(v) && v.length === 0) return false;
			return true;
		});
		if (filledRequired.length === 0) return 'empty';
		if (filledRequired.length === requiredFields.length) return 'complete';
		return 'partial';
	}

	function updateField(sectionKey: string, fieldKey: string, value: any) {
		data = { ...data, [sectionKey]: { ...(data[sectionKey] ?? {}), [fieldKey]: value } };
	}

	async function handleFileUpload(sectionKey: string, fieldKey: string, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const uploadKey = `${sectionKey}_${fieldKey}`;
		uploading = { ...uploading, [uploadKey]: true };

		try {
			const formData = new FormData();
			formData.set('file', file);
			formData.set('section_key', sectionKey);
			formData.set('field_key', fieldKey);
			const res = await fetch('?/uploadBillFile', { method: 'POST', body: formData });
			const result = await res.json();

			if (result.type === 'success' || result.data?.url) {
				const url = result.data?.url ?? result.url;
				const filename = result.data?.filename ?? file.name;
				updateField(sectionKey, fieldKey, url);
				updateField(sectionKey, `${fieldKey}_name`, filename);
			}
		} catch (err) {
			console.error('Upload failed:', err);
		} finally {
			uploading = { ...uploading, [uploadKey]: false };
		}
	}

	let completedCount = $derived(sectionEntries.filter(([k]) => getSectionStatus(k) === 'complete').length);
	let allComplete = $derived(completedCount === sectionEntries.length);

	// Styles
	const labelStyle = "display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)";
	const descStyle = "margin: 0 0 8px; font-size: 0.6875rem; color: oklch(0.55 0.02 180)";
	const inputStyle = "width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; outline: none; font-family: 'Noto Sans Thai', sans-serif";
	const fileWrapStyle = "display: flex; align-items: center; gap: 8px";
	const fileBtnStyle = "padding: 7px 14px; border-radius: 8px; border: 1px solid oklch(0.52 0.14 240 / 0.3); background: oklch(0.52 0.14 240 / 0.04); color: oklch(0.42 0.14 240); font-size: 0.75rem; font-weight: 500; cursor: pointer; font-family: 'Noto Sans Thai', sans-serif; white-space: nowrap";
	const fileNameStyle = "font-size: 0.6875rem; color: oklch(0.38 0.14 150); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px";
	const legalRefStyle = "font-size: 0.5625rem; color: oklch(0.6 0.04 240); font-style: italic";
</script>

<div>
	<!-- Header -->
	<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px">
		<div>
			<h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: oklch(0.25 0.02 180)">เอกสารจัดซื้อจัดจ้าง</h3>
			<p style="margin: 2px 0 0; font-size: 0.75rem; color: oklch(0.55 0.02 180)">
				กรอกครบ {completedCount}/{sectionEntries.length} ส่วน
			</p>
		</div>
		<div style="width: 120px; height: 6px; border-radius: 3px; background: oklch(0.92 0.005 180); overflow: hidden">
			<div style="width: {sectionEntries.length > 0 ? (completedCount / sectionEntries.length * 100) : 0}%; height: 100%; border-radius: 3px; background: oklch(0.54 0.16 150); transition: width 0.3s ease"></div>
		</div>
	</div>

	<!-- Sections driven by BILL_SECTION_DEFS -->
	{#each sectionEntries as [sectionKey, def]}
		<BillSectionAccordion
			title={def.label}
			sectionKey={sectionKey}
			status={getSectionStatus(sectionKey)}
		>
			{#if def.description}
				<p style={descStyle}>{def.description}</p>
			{/if}
			{#if def.legalRef}
				<p style={legalRefStyle}>อ้างอิง: {def.legalRef}</p>
			{/if}

			<div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px">
				{#each def.fields as field}
					<!-- PDF upload -->
					{#if field.type === 'pdf'}
						<div>
							<label style={labelStyle}>
								{field.label}
								{#if field.required}<span style="color: oklch(0.58 0.2 25)">*</span>{/if}
							</label>
							{#if field.description}<p style={descStyle}>{field.description}</p>{/if}
							<div style={fileWrapStyle}>
								<label style={fileBtnStyle}>
									{#if uploading[`${sectionKey}_${field.key}`]}
										กำลังอัปโหลด...
									{:else}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; display: inline; vertical-align: -2px; margin-right: 4px"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
										เลือกไฟล์ PDF
									{/if}
									<input type="file" accept=".pdf" style="display: none"
										onchange={(e) => handleFileUpload(sectionKey, field.key, e)}
										disabled={readonly || uploading[`${sectionKey}_${field.key}`]} />
								</label>
								{#if data[sectionKey]?.[field.key]}
									<span style={fileNameStyle}>
										{data[sectionKey]?.[`${field.key}_name`] ?? 'อัปโหลดแล้ว'}
									</span>
									<a href={data[sectionKey][field.key]} target="_blank" style="font-size: 0.625rem; color: oklch(0.42 0.14 240)">ดู</a>
								{/if}
							</div>
						</div>

					<!-- Committee selector -->
					{:else if field.type === 'committee'}
						<div>
							{#if field.description}<p style={descStyle}>{field.description}</p>{/if}
							<CommitteeSelector
								committeeType={field.label}
								{users}
								selected={data[sectionKey]?.[field.key] ?? []}
								onchange={(members) => updateField(sectionKey, field.key, members)}
							/>
						</div>

					<!-- Vendor list + quotations -->
					{:else if field.type === 'vendors'}
						<div>
							{#if field.description}<p style={descStyle}>{field.description}</p>{/if}
							<VendorQuotationList
								{vendors}
								quotations={data[sectionKey]?.[field.key] ?? []}
								winnerId={data[sectionKey]?.winner_vendor_id ?? null}
								onchange={({ quotations: q, winner_vendor_id }) => {
									updateField(sectionKey, field.key, q);
									if (winner_vendor_id !== undefined) {
										updateField(sectionKey, 'winner_vendor_id', winner_vendor_id);
									}
								}}
							/>
						</div>

					<!-- Text input -->
					{:else if field.type === 'text'}
						<div>
							<label style={labelStyle}>
								{field.label}
								{#if field.required}<span style="color: oklch(0.58 0.2 25)">*</span>{/if}
							</label>
							<textarea
								value={data[sectionKey]?.[field.key] ?? ''}
								onchange={(e) => updateField(sectionKey, field.key, e.currentTarget.value)}
								rows="3" disabled={readonly}
								style="{inputStyle}; resize: vertical"
								placeholder="ระบุรายละเอียด..."
							></textarea>
						</div>

					<!-- Date range -->
					{:else if field.type === 'date_range'}
						<div>
							<label style={labelStyle}>{field.label}</label>
							<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
								<input type="date" value={data[sectionKey]?.[`${field.key}_start`] ?? ''}
									onchange={(e) => updateField(sectionKey, `${field.key}_start`, e.currentTarget.value)}
									disabled={readonly} style={inputStyle} />
								<input type="date" value={data[sectionKey]?.[`${field.key}_end`] ?? ''}
									onchange={(e) => updateField(sectionKey, `${field.key}_end`, e.currentTarget.value)}
									disabled={readonly} style={inputStyle} />
							</div>
						</div>

					<!-- Items list (e-catalog) -->
					{:else if field.type === 'items'}
						<div>
							<label style={labelStyle}>{field.label}</label>
							{#each (data[sectionKey]?.[field.key] ?? []) as item, i}
								<div style="display: grid; grid-template-columns: 1fr 80px 100px auto; gap: 6px; margin-bottom: 6px; align-items: center">
									<input value={item.name ?? ''} placeholder="ชื่อ"
										onchange={(e) => { const items = [...(data[sectionKey]?.[field.key] ?? [])]; items[i] = { ...items[i], name: e.currentTarget.value }; updateField(sectionKey, field.key, items); }}
										style="padding: 6px 10px; border-radius: 6px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; font-family: 'Noto Sans Thai', sans-serif" />
									<input value={item.quantity ?? ''} type="number" placeholder="จำนวน"
										onchange={(e) => { const items = [...(data[sectionKey]?.[field.key] ?? [])]; items[i] = { ...items[i], quantity: Number(e.currentTarget.value) }; updateField(sectionKey, field.key, items); }}
										style="padding: 6px 10px; border-radius: 6px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; text-align: right" />
									<input value={item.unit_price ?? ''} placeholder="ราคา/หน่วย"
										onchange={(e) => { const items = [...(data[sectionKey]?.[field.key] ?? [])]; items[i] = { ...items[i], unit_price: e.currentTarget.value }; updateField(sectionKey, field.key, items); }}
										style="padding: 6px 10px; border-radius: 6px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; text-align: right" />
									<button type="button" onclick={() => { const items = (data[sectionKey]?.[field.key] ?? []).filter((_: any, j: number) => j !== i); updateField(sectionKey, field.key, items); }}
										style="width: 22px; height: 22px; border-radius: 50%; border: none; background: oklch(0.58 0.2 25 / 0.08); color: oklch(0.58 0.2 25); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem">&times;</button>
								</div>
							{/each}
							<button type="button" onclick={() => { const items = [...(data[sectionKey]?.[field.key] ?? []), { name: '', quantity: 1, unit_price: '' }]; updateField(sectionKey, field.key, items); }}
								style="padding: 6px 14px; border-radius: 6px; border: 1px dashed oklch(0.82 0.04 240); background: none; color: oklch(0.45 0.1 240); font-size: 0.75rem; cursor: pointer; font-family: 'Noto Sans Thai', sans-serif">+ เพิ่มรายการ</button>
						</div>
					{/if}
				{/each}
			</div>
		</BillSectionAccordion>
	{/each}

	<!-- Action Buttons -->
	{#if !readonly}
		<div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid oklch(0.92 0.005 180)">
			<button type="button" onclick={() => onsave(data)}
				style="padding: 10px 20px; border-radius: 10px; border: 1px solid oklch(0.88 0.01 180); background: white; color: oklch(0.35 0.02 180); font-size: 0.875rem; font-weight: 500; cursor: pointer; font-family: 'Noto Sans Thai', sans-serif">
				บันทึกร่าง
			</button>
			<button type="button" onclick={() => onsubmit(data)} disabled={!allComplete}
				style="padding: 10px 24px; border-radius: 10px; border: none; background: oklch(0.54 0.16 150); color: white; font-size: 0.875rem; font-weight: 600; cursor: pointer; opacity: {allComplete ? '1' : '0.5'}; font-family: 'Noto Sans Thai', sans-serif">
				ส่งการเงิน
			</button>
		</div>
	{/if}
</div>
