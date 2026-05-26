<script lang="ts">
	import BillSectionAccordion from './BillSectionAccordion.svelte';
	import CommitteeSelector from './CommitteeSelector.svelte';
	import VendorQuotationList from './VendorQuotationList.svelte';
	import { BILL_SECTION_DEFS, type BillSectionDef } from '$lib/types/procurement';
	import { deserialize } from '$app/forms';

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
			const result = deserialize(await res.text());

			if (result.type === 'success' && result.data) {
				const d = result.data as Record<string, any>;
				updateField(sectionKey, fieldKey, d.url);
				updateField(sectionKey, `${fieldKey}_name`, d.filename ?? file.name);
			} else if (result.type === 'failure') {
				console.error('Upload failed:', (result.data as any)?.errors);
			}
		} catch (err) {
			console.error('Upload failed:', err);
		} finally {
			uploading = { ...uploading, [uploadKey]: false };
			input.value = '';
		}
	}

	let completedCount = $derived(sectionEntries.filter(([k]) => getSectionStatus(k) === 'complete').length);
	let allComplete = $derived(completedCount === sectionEntries.length);

	function removeFile(sectionKey: string, fieldKey: string) {
		updateField(sectionKey, fieldKey, null);
		updateField(sectionKey, `${fieldKey}_name`, null);
	}

	// Styles
	const labelStyle = "display: block; margin-bottom: 4px; font-size: 0.75rem; font-weight: 600; color: oklch(0.4 0.02 180)";
	const descStyle = "margin: 0 0 8px; font-size: 0.6875rem; color: oklch(0.55 0.02 180)";
	const inputStyle = "width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; outline: none; font-family: 'Noto Sans Thai', sans-serif";
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

							{#if data[sectionKey]?.[field.key]}
								<!-- File preview card -->
								<div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; background: oklch(0.54 0.16 150 / 0.04); border: 1px solid oklch(0.54 0.16 150 / 0.15)">
									<div style="flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px; background: oklch(0.58 0.2 25 / 0.08); display: flex; align-items: center; justify-content: center">
										<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.55 0.18 25)" stroke-width="1.5" style="width: 20px; height: 20px"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
									</div>
									<div style="flex: 1; min-width: 0">
										<p style="margin: 0; font-size: 0.8125rem; font-weight: 500; color: oklch(0.3 0.02 180); overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
											{data[sectionKey]?.[`${field.key}_name`] ?? 'เอกสาร PDF'}
										</p>
										<p style="margin: 2px 0 0; font-size: 0.6875rem; color: oklch(0.54 0.16 150)">อัปโหลดแล้ว</p>
									</div>
									<div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0">
										<a href={data[sectionKey][field.key]} target="_blank" rel="noopener"
											style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: oklch(0.52 0.14 240 / 0.06); color: oklch(0.42 0.14 240); transition: background 0.15s ease"
											title="ดูไฟล์">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 16px; height: 16px"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
										</a>
										{#if !readonly}
											<button type="button"
												onclick={() => removeFile(sectionKey, field.key)}
												style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: none; background: oklch(0.58 0.2 25 / 0.06); color: oklch(0.52 0.2 25); cursor: pointer; transition: background 0.15s ease"
												title="ลบไฟล์">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 16px; height: 16px"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
											</button>
										{/if}
									</div>
								</div>
							{:else}
								<!-- Upload dropzone -->
								<label style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 20px 16px; border-radius: 10px; border: 1.5px dashed oklch(0.82 0.04 240); background: oklch(0.98 0.005 240); cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease"
									onmouseenter={(e) => { e.currentTarget.style.borderColor = 'oklch(0.62 0.12 240)'; e.currentTarget.style.background = 'oklch(0.96 0.01 240)'; }}
									onmouseleave={(e) => { e.currentTarget.style.borderColor = 'oklch(0.82 0.04 240)'; e.currentTarget.style.background = 'oklch(0.98 0.005 240)'; }}>
									{#if uploading[`${sectionKey}_${field.key}`]}
										<div style="width: 20px; height: 20px; border: 2px solid oklch(0.52 0.14 240 / 0.2); border-top-color: oklch(0.52 0.14 240); border-radius: 50%; animation: spin 0.6s linear infinite"></div>
										<span style="font-size: 0.75rem; color: oklch(0.5 0.08 240); font-weight: 500">กำลังอัปโหลด...</span>
									{:else}
										<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.6 0.08 240)" stroke-width="1.5" style="width: 24px; height: 24px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
										<span style="font-size: 0.75rem; color: oklch(0.45 0.08 240); font-weight: 500">คลิกเพื่อเลือกไฟล์ PDF</span>
										<span style="font-size: 0.625rem; color: oklch(0.6 0.03 240)">ขนาดไม่เกิน 5 MB</span>
									{/if}
									<input type="file" accept=".pdf" style="display: none"
										onchange={(e) => handleFileUpload(sectionKey, field.key, e)}
										disabled={readonly || uploading[`${sectionKey}_${field.key}`]} />
								</label>
							{/if}
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

<style>
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
