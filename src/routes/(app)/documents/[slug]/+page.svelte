<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatBaht } from '$lib/utils/format';
	import { watchFormResult } from '$lib/stores/toast.svelte';

	let { data, form: formResult } = $props();
	watchFormResult(() => formResult);

	let showRejectModal = $state(false);
	let rejectStepId = $state<number | null>(null);
	let rejectComment = $state('');

	const docTypeLabels: Record<string, string> = {
		type1_nParcel: 'ซื้อครั้งเดียว จ่ายครั้งเดียว',
		type2_iParcelUtil: 'ค่าสาธารณูปโภค',
		type3_iParcel: 'ค่าซ่อมบำรุง',
		type4_iFinance: 'ค่าตอบแทน (ตรงการเงิน)',
		type5_project: 'โครงการ'
	};

	const phaseLabels: Record<string, string> = {
		APPROVAL: 'ขั้นตอนอนุมัติ',
		EXECUTION: 'ดำเนินการ',
		COMPLETED: 'เสร็จสิ้น'
	};

	function formatDate(d: string | null) {
		if (!d) return '';
		return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<div>
	<!-- Header -->
	<div style="margin-bottom: 24px">
		<BackButton href="/documents" label="กลับหน้าเอกสาร" />
		<h1 style="margin: 8px 0 4px; font-size: clamp(1.375rem, 1.1rem + 0.7vw, 1.625rem); font-weight: 700; color: oklch(0.2 0.02 180)">เอกสารจัดซื้อจัดจ้าง</h1>
		<p style="font-size: 0.875rem; color: oklch(0.5 0.02 180); margin: 0">
			{docTypeLabels[data.document.doc_type ?? ''] ?? ''} | แผน: {data.plan?.title}
		</p>
		<div style="margin-top: 8px; display: flex; gap: 8px; align-items: center">
			<StatusBadge status={data.document.status} />
			<span style="padding: 2px 10px; border-radius: 8px; font-size: 0.6875rem; font-weight: 600; background: oklch(0.52 0.14 240 / 0.08); color: oklch(0.42 0.14 240)">
				{phaseLabels[data.document.phase] ?? data.document.phase}
			</span>
		</div>
	</div>

	<!-- Approval Steps Progress -->
	{#if data.document.phase === 'APPROVAL' || data.approvalSteps.length > 0}
		<div style="margin-bottom: 28px">
			<h2 style="margin: 0 0 14px; font-size: 1rem; font-weight: 700; color: oklch(0.25 0.02 180)">ขั้นตอนอนุมัติ</h2>
			<div style="display: flex; flex-direction: column; gap: 0">
				{#each data.approvalSteps as step, i}
					{@const isCurrent = step.status === 'IN_PROGRESS'}
					{@const isDone = step.status === 'APPROVED'}
					{@const isRejected = step.status === 'REJECTED'}
					{@const canAct = isCurrent && (data.user.is_super_admin || step.assigned_user_id === data.user.sub)}
					{@const isLast = i === data.approvalSteps.length - 1}

					<div style="display: flex; gap: 14px">
						<!-- Timeline -->
						<div style="display: flex; flex-direction: column; align-items: center; width: 32px; flex-shrink: 0">
							<div style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6875rem; font-weight: 700; color: white; background: {isDone ? 'oklch(0.54 0.16 150)' : isRejected ? 'oklch(0.58 0.2 25)' : isCurrent ? 'oklch(0.52 0.14 240)' : 'oklch(0.82 0.02 180)'}; transition: background 0.3s ease">
								{#if isDone}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 14px; height: 14px"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
								{:else if isRejected}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 14px; height: 14px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
								{:else}
									{step.step_sequence}
								{/if}
							</div>
							{#if !isLast}
								<div style="width: 2px; flex: 1; min-height: 20px; background: {isDone ? 'oklch(0.54 0.16 150)' : 'oklch(0.9 0.01 180)'}; transition: background 0.3s ease"></div>
							{/if}
						</div>

						<!-- Content -->
						<div style="flex: 1; padding-bottom: {isLast ? '0' : '16px'}">
							<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
								<div>
									<h3 style="margin: 0; font-size: 0.875rem; font-weight: 600; color: {isCurrent ? 'oklch(0.3 0.06 240)' : 'oklch(0.3 0.02 180)'}">{step.step_name}</h3>
									{#if step.assigned_user_name}
										<p style="margin: 2px 0 0; font-size: 0.6875rem; color: oklch(0.55 0.02 180)">ผู้รับผิดชอบ: {step.assigned_user_name}</p>
									{/if}
									{#if step.comment}
										<p style="margin: 4px 0 0; font-size: 0.75rem; padding: 6px 10px; border-radius: 6px; background: oklch(0.58 0.2 25 / 0.06); color: oklch(0.45 0.15 25)">"{step.comment}"</p>
									{/if}
									{#if step.completed_at}
										<p style="margin: 2px 0 0; font-size: 0.625rem; color: oklch(0.6 0.02 180)">{formatDate(step.completed_at)}</p>
									{/if}
								</div>

								<!-- Action Buttons -->
								{#if canAct}
									<div style="display: flex; gap: 6px; flex-shrink: 0">
										<form method="POST" action="?/approveStep" use:enhance>
											<input type="hidden" name="step_id" value={step.id} />
											<input type="hidden" name="action" value="APPROVED" />
											<button type="submit" style="padding: 6px 14px; border-radius: 8px; border: none; font-size: 0.75rem; font-weight: 600; cursor: pointer; color: white; background: oklch(0.54 0.16 150)">อนุมัติ</button>
										</form>
										<button type="button" onclick={() => { rejectStepId = step.id; showRejectModal = true; rejectComment = ''; }}
											style="padding: 6px 14px; border-radius: 8px; border: none; font-size: 0.75rem; font-weight: 600; cursor: pointer; color: white; background: oklch(0.58 0.2 25)">ปฏิเสธ</button>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- After Approval: Routing Info -->
	{#if data.document.phase === 'EXECUTION'}
		<div style="padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; background: oklch(0.54 0.16 150 / 0.06); border: 1px solid oklch(0.54 0.16 150 / 0.15)">
			<p style="margin: 0; font-size: 0.875rem; font-weight: 600; color: oklch(0.38 0.14 150)">
				{#if ['type1_nParcel', 'type2_iParcelUtil', 'type3_iParcel'].includes(data.document.doc_type ?? '')}
					อนุมัติแล้ว — ดำเนินการต่อที่
					<a href="/procurement" style="color: oklch(0.42 0.14 240); font-weight: 700; text-decoration: underline">หน้าจัดซื้อจัดจ้าง</a>
				{:else if data.document.doc_type === 'type4_iFinance'}
					อนุมัติแล้ว — ดำเนินการต่อที่
					<a href="/finance" style="color: oklch(0.42 0.14 240); font-weight: 700; text-decoration: underline">หน้าการเงิน</a>
				{:else}
					อนุมัติแล้ว — จัดการรายการโครงการด้านล่าง
				{/if}
			</p>
		</div>
	{/if}

	<!-- Type5 Project Items -->
	{#if data.document.doc_type === 'type5_project' && (data.document.phase === 'EXECUTION' || data.document.phase === 'COMPLETED')}
		<div style="margin-bottom: 24px">
			<h2 style="margin: 0 0 14px; font-size: 1rem; font-weight: 700; color: oklch(0.25 0.02 180)">รายการโครงการ</h2>

			{#if data.document.phase === 'EXECUTION'}
				<form method="POST" action="?/createProjectItem" use:enhance style="margin-bottom: 14px; padding: 14px; border-radius: 12px; background: oklch(0.97 0.005 180); border: 1px solid oklch(0.92 0.005 180)">
					<div style="display: grid; grid-template-columns: 1fr 120px 120px auto; gap: 10px; align-items: end">
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 0.6875rem; font-weight: 600; color: oklch(0.5 0.02 180)">ชื่อรายการ</label>
							<input name="item_name" required style="width: 100%; padding: 7px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; outline: none; font-family: 'Noto Sans Thai', sans-serif" />
						</div>
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 0.6875rem; font-weight: 600; color: oklch(0.5 0.02 180)">ประเภท</label>
							<select name="item_type" required style="width: 100%; padding: 7px 8px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; font-family: 'Noto Sans Thai', sans-serif">
								<option value="pFinance">ยืมเงิน</option>
								<option value="pParcel">จัดซื้อ</option>
							</select>
						</div>
						<div>
							<label style="display: block; margin-bottom: 4px; font-size: 0.6875rem; font-weight: 600; color: oklch(0.5 0.02 180)">งบประมาณ</label>
							<input name="estimated_amount" type="number" step="0.01" style="width: 100%; padding: 7px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; outline: none; font-family: 'Noto Sans Thai', sans-serif" />
						</div>
						<button type="submit" style="padding: 7px 16px; border-radius: 8px; border: none; background: oklch(0.52 0.14 240); color: white; font-size: 0.8125rem; font-weight: 500; cursor: pointer; white-space: nowrap">เพิ่ม</button>
					</div>
				</form>
			{/if}

			<div style="display: flex; flex-direction: column; gap: 6px">
				{#each data.projectItems as item}
					<div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: white; border: 1px solid oklch(0.92 0.005 180)">
						<div style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.625rem; font-weight: 700; flex-shrink: 0; background: {item.item_type === 'pFinance' ? 'oklch(0.94 0.08 85)' : 'oklch(0.93 0.06 240)'}; color: {item.item_type === 'pFinance' ? 'oklch(0.45 0.12 85)' : 'oklch(0.45 0.12 240)'}">
							{item.item_type === 'pFinance' ? 'F' : 'P'}
						</div>
						<div style="flex: 1; min-width: 0">
							<span style="font-size: 0.8125rem; font-weight: 600; color: oklch(0.25 0.02 180)">{item.item_name}</span>
							<span style="margin-left: 8px; font-size: 0.6875rem; color: oklch(0.55 0.02 180)">
								{item.item_type === 'pFinance' ? 'ยืมเงิน' : 'จัดซื้อ'} | {formatBaht(item.estimated_amount)}
							</span>
						</div>
						<span style="padding: 2px 10px; border-radius: 6px; font-size: 0.625rem; font-weight: 600; background: {item.status === 'COMPLETED' ? 'oklch(0.93 0.08 150)' : 'oklch(0.95 0.01 180)'}; color: {item.status === 'COMPLETED' ? 'oklch(0.38 0.12 150)' : 'oklch(0.5 0.02 180)'}">
							{item.status === 'COMPLETED' ? 'เสร็จสิ้น' : item.status === 'IN_PROGRESS' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
						</span>
					</div>
				{/each}
			</div>

			{#if data.document.phase === 'EXECUTION' && data.projectItems.length > 0}
				<form method="POST" action="?/closeProject" use:enhance style="margin-top: 14px">
					<button type="submit" style="padding: 8px 18px; border-radius: 10px; border: none; background: oklch(0.54 0.16 150); color: white; font-size: 0.8125rem; font-weight: 600; cursor: pointer">ปิดโครงการ + คืนเงินเหลือ</button>
				</form>
			{/if}
		</div>
	{/if}

	<!-- Plan Info -->
	{#if data.plan}
		<div style="padding: 14px 18px; border-radius: 12px; background: oklch(0.97 0.005 180); border: 1px solid oklch(0.92 0.005 180)">
			<p style="margin: 0 0 2px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: oklch(0.5 0.02 180)">แผนงาน</p>
			<p style="margin: 0; font-size: 0.875rem; font-weight: 600; color: oklch(0.25 0.02 180)">{data.plan.title}</p>
			<p style="margin: 4px 0 0; font-size: 0.75rem; color: oklch(0.5 0.02 180)">งบประมาณ: {formatBaht(data.plan.estimated_amount)} | ใช้จริง: {formatBaht(data.plan.actual_amount)}</p>
		</div>
	{/if}
</div>

<!-- Reject Modal -->
{#if showRejectModal && rejectStepId}
	<div style="position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: oklch(0.15 0.02 180 / 0.5); backdrop-filter: blur(4px)" onclick={() => (showRejectModal = false)}>
		<div style="background: white; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 24px 48px oklch(0.15 0.02 180 / 0.2)" onclick={(e) => e.stopPropagation()}>
			<form method="POST" action="?/approveStep" use:enhance={() => {
				return async ({ update, result }) => { if (result.type === 'success') { showRejectModal = false; rejectStepId = null; } await update(); };
			}}>
				<input type="hidden" name="step_id" value={rejectStepId} />
				<input type="hidden" name="action" value="REJECTED" />
				<div style="padding: 24px">
					<h3 style="margin: 0 0 12px; font-size: 1rem; font-weight: 700; color: oklch(0.58 0.2 25)">ปฏิเสธเอกสาร</h3>
					<label style="display: block; margin-bottom: 4px; font-size: 0.8125rem; font-weight: 500; color: oklch(0.35 0.02 180)">เหตุผล</label>
					<textarea name="comment" bind:value={rejectComment} rows="3"
						style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.8125rem; resize: vertical; outline: none; font-family: 'Noto Sans Thai', sans-serif"
						placeholder="ระบุเหตุผลในการปฏิเสธ..."></textarea>
				</div>
				<div style="padding: 12px 24px 20px; display: flex; justify-content: flex-end; gap: 8px">
					<button type="button" onclick={() => (showRejectModal = false)} style="padding: 8px 16px; border-radius: 8px; border: none; background: none; color: oklch(0.45 0.02 180); font-size: 0.8125rem; cursor: pointer">ยกเลิก</button>
					<button type="submit" style="padding: 8px 18px; border-radius: 8px; border: none; background: oklch(0.58 0.2 25); color: white; font-size: 0.8125rem; font-weight: 600; cursor: pointer">ยืนยันปฏิเสธ</button>
				</div>
			</form>
		</div>
	</div>
{/if}
