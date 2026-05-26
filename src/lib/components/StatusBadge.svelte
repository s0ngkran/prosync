<script lang="ts">
	let {
		status,
		label
	}: {
		status: string;
		label?: string;
	} = $props();

	// Status color mapping with hospital-healthy theme
	const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
		DRAFT: { bg: 'oklch(0.94 0.008 180 / 0.8)', text: 'oklch(0.46 0.035 180)', dot: 'oklch(0.70 0.025 180)' },
		IN_PROGRESS: { bg: 'oklch(0.93 0.04 240 / 0.8)', text: 'oklch(0.45 0.12 240)', dot: 'oklch(0.52 0.14 240)' },
		COMPLETED: { bg: 'oklch(0.93 0.04 150 / 0.8)', text: 'oklch(0.46 0.14 150)', dot: 'oklch(0.54 0.16 150)' },
		APPROVED: { bg: 'oklch(0.93 0.04 150 / 0.8)', text: 'oklch(0.46 0.14 150)', dot: 'oklch(0.54 0.16 150)' },
		APPROVED_PROCUREMENT: { bg: 'oklch(0.93 0.04 150 / 0.8)', text: 'oklch(0.46 0.14 150)', dot: 'oklch(0.54 0.16 150)' },
		REJECTED: { bg: 'oklch(0.93 0.04 25 / 0.8)', text: 'oklch(0.58 0.18 25)', dot: 'oklch(0.58 0.18 25)' },
		PAID: { bg: 'oklch(0.93 0.04 150 / 0.8)', text: 'oklch(0.46 0.14 150)', dot: 'oklch(0.54 0.16 150)' },
		PENDING: { bg: 'oklch(0.95 0.04 85 / 0.8)', text: 'oklch(0.68 0.12 75)', dot: 'oklch(0.75 0.12 85)' },
		PENDING_EXAMINE: { bg: 'oklch(0.95 0.04 85 / 0.8)', text: 'oklch(0.68 0.12 75)', dot: 'oklch(0.75 0.12 85)' },
		SUBMITTED: { bg: 'oklch(0.93 0.04 150 / 0.8)', text: 'oklch(0.46 0.14 150)', dot: 'oklch(0.54 0.16 150)' },
		OVERDUE: { bg: 'oklch(0.93 0.06 25 / 0.8)', text: 'oklch(0.50 0.20 25)', dot: 'oklch(0.58 0.22 25)' },
		REPAID: { bg: 'oklch(0.93 0.04 150 / 0.8)', text: 'oklch(0.46 0.14 150)', dot: 'oklch(0.54 0.16 150)' }
	};

	const DEFAULT_STYLE = { bg: 'oklch(0.94 0.008 180 / 0.8)', text: 'oklch(0.58 0.030 180)', dot: 'oklch(0.70 0.025 180)' };

	const style = $derived(STATUS_STYLES[status] || DEFAULT_STYLE);
	const displayLabel = $derived(label || STATUS_LABELS[status] || status);

	// Import STATUS_LABELS from format utility
	const STATUS_LABELS: Record<string, string> = {
		DRAFT: 'ร่าง',
		IN_PROGRESS: 'กำลังดำเนินการ',
		COMPLETED: 'เสร็จสิ้น',
		APPROVED: 'อนุมัติแล้ว',
		APPROVED_PROCUREMENT: 'อนุมัติแล้ว',
		REJECTED: 'ปฏิเสธ',
		PAID: 'จ่ายแล้ว',
		PENDING: 'รอดำเนินการ',
		PENDING_EXAMINE: 'รอตรวจสอบ',
		SUBMITTED: 'ส่งแล้ว',
		OVERDUE: 'เกินกำหนด',
		REPAID: 'ชำระคืนแล้ว'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 hover:scale-105"
	style="
		background-color: {style.bg};
		color: {style.text};
		box-shadow: 0 1px 2px 0 oklch(0.58 0.030 180 / 0.06);
	"
>
	<span class="relative flex h-1.5 w-1.5">
		<span
			class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
			style="background-color: {style.dot};"
		></span>
		<span
			class="relative inline-flex h-1.5 w-1.5 rounded-full"
			style="background-color: {style.dot};"
		></span>
	</span>
	{displayLabel}
</span>
