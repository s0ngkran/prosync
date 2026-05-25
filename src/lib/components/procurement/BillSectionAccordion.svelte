<script lang="ts">
	let {
		title,
		sectionKey,
		status = 'empty',
		children
	}: {
		title: string;
		sectionKey: string;
		status?: 'empty' | 'partial' | 'complete';
		children: any;
	} = $props();

	let expanded = $state(false);

	const statusConfig = {
		empty: { label: 'ยังไม่กรอก', color: 'oklch(0.55 0.02 180)', bg: 'oklch(0.95 0.01 180)', dot: 'oklch(0.8 0.02 180)' },
		partial: { label: 'ไม่สมบูรณ์', color: 'oklch(0.48 0.14 60)', bg: 'oklch(0.62 0.18 60 / 0.08)', dot: 'oklch(0.62 0.18 60)' },
		complete: { label: 'กรอกแล้ว', color: 'oklch(0.38 0.14 150)', bg: 'oklch(0.54 0.16 150 / 0.08)', dot: 'oklch(0.54 0.16 150)' }
	};

	let cfg = $derived(statusConfig[status]);
</script>

<div style="border: 1px solid oklch(0.92 0.005 180); border-radius: 12px; overflow: hidden; margin-bottom: 8px; background: white">
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		style="width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 18px; border: none; background: none; cursor: pointer; text-align: left; font-family: 'Noto Sans Thai', sans-serif"
	>
		<!-- Status dot -->
		<div style="width: 8px; height: 8px; border-radius: 50%; background: {cfg.dot}; flex-shrink: 0"></div>

		<!-- Title -->
		<span style="flex: 1; font-size: 0.875rem; font-weight: 600; color: oklch(0.25 0.02 180)">{title}</span>

		<!-- Status badge -->
		<span style="padding: 2px 10px; border-radius: 6px; font-size: 0.625rem; font-weight: 600; background: {cfg.bg}; color: {cfg.color}">{cfg.label}</span>

		<!-- Chevron -->
		<svg viewBox="0 0 24 24" fill="none" stroke="oklch(0.6 0.02 180)" stroke-width="2" style="width: 16px; height: 16px; transition: transform 0.2s ease; transform: rotate({expanded ? '180' : '0'}deg)">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if expanded}
		<div style="padding: 0 18px 18px; border-top: 1px solid oklch(0.94 0.005 180)">
			<div style="padding-top: 14px">
				{@render children()}
			</div>
		</div>
	{/if}
</div>
