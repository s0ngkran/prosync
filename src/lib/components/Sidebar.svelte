<script lang="ts">
	import { page } from '$app/stores';
	import type { JWTPayload } from '$lib/types/auth';

	let { user, open, pendingTaskCount = 0, pendingFinanceCount = 0, pendingDocumentCount = 0 }: { user: JWTPayload; open: boolean; pendingTaskCount?: number; pendingFinanceCount?: number; pendingDocumentCount?: number } = $props();

	// Paths under /admin that belong to org-management (not system admin)
	const orgManagementAdminPaths = ['/admin/users', '/admin/roles', '/admin/org-structure'];

	const p = $derived(user.permissions);

	const navItems = $derived(
		[
			{ href: '/dashboard', label: 'แดชบอร์ด', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', show: user.is_super_admin || user.is_director || p.can_view_dashboard, matchAlso: [] as string[] },
			{ href: '/org-management', label: 'โครงสร้างองค์กร', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', show: true, matchAlso: orgManagementAdminPaths },
			{ href: '/planning', label: 'แผนยุทธศาสตร์', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', show: user.is_super_admin || p.can_manage_plans || p.can_view_plans, matchAlso: [] as string[] },
			{ href: '/documents', label: 'เอกสารจัดซื้อจัดจ้าง', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', show: true, matchAlso: [] as string[] },
			{ href: '/procurement', label: 'จัดซื้อจัดจ้าง', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z', show: user.is_super_admin || p.can_manage_procurement || p.can_view_procurement, matchAlso: [] as string[] },
			{ href: '/finance', label: 'การเงินและเบิกจ่าย', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', show: user.is_super_admin || p.can_manage_finance || p.can_view_finance, matchAlso: [] as string[] },
			{ href: '/audit', label: 'ประวัติการเปลี่ยนแปลง', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', show: user.is_super_admin || p.can_view_audit_trail, matchAlso: [] as string[] },
			{ href: '/admin', label: 'จัดการระบบ', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', show: user.is_super_admin, matchAlso: [] as string[] }
		].filter((item) => item.show)
	);

	function isActive(item: typeof navItems[number], pathname: string): boolean {
		// Check if another item claims this path via matchAlso
		if (pathname.startsWith(item.href)) {
			// If this is /admin, don't match paths claimed by org-management
			const claimedByOther = navItems.some(
				(other) => other.href !== item.href && other.matchAlso.some((p) => pathname.startsWith(p))
			);
			if (claimedByOther) return false;
			return true;
		}
		return item.matchAlso.some((p) => pathname.startsWith(p));
	}
</script>

<aside
	class="flex w-64 flex-col border-r transition-all duration-300 ease-out-expo
		{open 
			? 'translate-x-0 bg-white/95 backdrop-blur-sm' 
			: '-translate-x-full absolute z-40 h-full bg-white/95 backdrop-blur-sm'}"
	style="border-color: oklch(0.90 0.012 180 / 0.8);"
>
	<!-- Brand -->
	<div class="group flex h-20 items-center gap-3 border-b px-4 transition-colors duration-200"
		style="border-color: oklch(0.94 0.008 180 / 0.6);"
	>
		<img
			src="/PROSYNC-ERP.png"
			alt="ProSync ERP"
			class="h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
		/>
		<div class="flex flex-col">
			<span class="text-base font-bold tracking-tight" style="color: oklch(0.30 0.045 180);">ProSync ERP</span>
			<span class="text-[10px] font-medium" style="color: oklch(0.58 0.030 180);">Organizational Development</span>
		</div>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
		{#each navItems as item, i}
			{@const active = isActive(item, $page.url.pathname)}
			<a
				href={item.href}
				class="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
					transition-all duration-200 ease-out-quart
					focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
				style="
					{active 
						? 'background-color: oklch(0.93 0.04 240 / 0.5);' 
						: ''}
				"
			>
				<!-- Active indicator bar -->
				{#if active}
					<div class="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-500 to-health-500"></div>
				{/if}
				
				<!-- Icon with background -->
				<div class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200
					{active 
						? 'bg-white shadow-sm' 
						: 'bg-transparent group-hover:bg-white/60'}"
					style="
						{active 
							? 'color: oklch(0.52 0.14 240);' 
							: 'color: oklch(0.70 0.025 180);'}
						{!active && 'group-hover: color: oklch(0.58 0.030 180);'}
					"
				>
					<svg
						class="h-4 w-4 transition-transform duration-200 group-hover:scale-110"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
					</svg>
				</div>
				
				<!-- Label -->
				<span class="flex-1 transition-colors duration-200"
					style="
						{active
							? 'color: oklch(0.45 0.12 240);'
							: 'color: oklch(0.58 0.030 180);'}
						{!active && 'group-hover: color: oklch(0.38 0.040 180);'}
					"
				>
					{item.label}
				</span>

				<!-- Pending task badges -->
				{#if item.href === '/documents' && pendingDocumentCount > 0}
					<span class="task-badge">{pendingDocumentCount > 99 ? '99+' : pendingDocumentCount}</span>
				{/if}
				{#if item.href === '/procurement' && pendingTaskCount > 0}
					<span class="task-badge">{pendingTaskCount > 99 ? '99+' : pendingTaskCount}</span>
				{/if}
				{#if item.href === '/finance' && pendingFinanceCount > 0}
					<span class="task-badge">{pendingFinanceCount > 99 ? '99+' : pendingFinanceCount}</span>
				{/if}

				<!-- Hover background glow -->
				{#if !active}
					<div class="absolute inset-0 -z-10 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
						style="background: linear-gradient(90deg, oklch(0.97 0.02 240 / 0.4), transparent);"></div>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Footer -->
	<div class="border-t px-4 py-4" style="border-color: oklch(0.94 0.008 180 / 0.6);">
		<div class="flex items-center gap-2 rounded-lg bg-gradient-to-br from-brand-50 to-health-50 p-2.5">
			<div class="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm">
				<svg class="h-3.5 w-3.5" style="color: oklch(0.52 0.14 240);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
				</svg>
			</div>
			<div class="flex flex-col">
				<span class="text-[10px] font-semibold" style="color: oklch(0.45 0.12 240);">v1.0.0</span>
				<span class="text-[9px]" style="color: oklch(0.58 0.030 180);">Latest Release</span>
			</div>
		</div>
	</div>
<style>
	.task-badge {
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: oklch(0.58 0.2 25);
		color: white;
		font-size: 0.625rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		flex-shrink: 0;
	}
</style>
</aside>
