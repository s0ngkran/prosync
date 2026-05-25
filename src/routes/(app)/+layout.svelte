<script lang="ts">
	import type { LayoutData } from './$types';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import DevTool from '$lib/components/DevTool.svelte';
	import { initCounts, getProcurementCount, getFinanceCount, getTotalCount } from '$lib/stores/taskCounts.svelte';

	let { data, children } = $props();
	let sidebarOpen = $state(true);
	let showProfileMenu = $state(false);

	// Initialize reactive task counts from server data
	$effect(() => {
		initCounts(data.pendingTaskCount, data.pendingFinanceCount);
	});

	let procCount = $derived(getProcurementCount());
	let finCount = $derived(getFinanceCount());
	let totalCount = $derived(getTotalCount());
</script>

<svelte:window onclick={() => { showProfileMenu = false; }} />

<div class="flex h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-health-50/20">
	<Sidebar user={data.user} open={sidebarOpen} pendingTaskCount={procCount} pendingFinanceCount={finCount} pendingDocumentCount={data.pendingDocumentCount ?? 0} />

	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Top Navbar (z-auto, no stacking context) -->
		<header class="flex h-20 shrink-0 items-center justify-between border-b bg-white/95 px-6"
			style="border-color: oklch(0.90 0.012 180 / 0.5); box-shadow: 0 1px 3px 0 oklch(0.58 0.030 180 / 0.06);"
		>
			<div class="flex items-center gap-4">
				<button
					onclick={() => (sidebarOpen = !sidebarOpen)}
					class="group relative -ml-2 rounded-xl p-2 transition-all duration-200 hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
					aria-label="เปิด/ปิดเมนูด้านข้าง"
				>
					<svg class="h-5 w-5 transition-colors duration-200" style="color: oklch(0.58 0.030 180);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>

				<div class="hidden items-center gap-2 text-sm md:flex">
					<span style="color: oklch(0.70 0.025 180);">ระบบ</span>
					<svg class="h-4 w-4" style="color: oklch(0.84 0.018 180);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<!-- Notification Bell -->
				<NotificationBell initialCount={data.notificationCount} pendingProcurement={procCount} pendingFinance={finCount} />

				<!-- User info with profile dropdown -->
				<div class="profile-container" onclick={(e: MouseEvent) => e.stopPropagation()}>
					<button
						class="group flex items-center gap-2.5 rounded-xl bg-white/60 px-3 py-1.5 transition-all duration-200 hover:bg-white hover:shadow-md"
						style="box-shadow: 0 1px 2px 0 oklch(0.58 0.030 180 / 0.04); border: none; cursor: pointer; font-family: 'Noto Sans Thai', sans-serif;"
						onclick={() => (showProfileMenu = !showProfileMenu)}
					>
						{#if data.user.profile_picture}
							<img src={data.user.profile_picture} alt="" class="h-8 w-8 rounded-full object-cover shadow-sm" />
						{:else}
							<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-health-500 text-xs font-semibold text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
								{data.user.name.charAt(0)}
							</div>
						{/if}
						<div class="flex flex-col text-left">
							<span class="text-sm font-medium leading-tight" style="color: oklch(0.38 0.040 180);">{data.user.name}</span>
							{#if data.user.is_super_admin}
								<span class="text-[9px] font-medium leading-tight" style="color: oklch(0.54 0.16 150);">Administrator</span>
							{:else if data.user.position_rank}
								<span class="text-[9px] font-medium leading-tight" style="color: oklch(0.58 0.030 180);">{data.user.position_rank}</span>
							{/if}
						</div>
						<svg class="h-3.5 w-3.5 transition-transform duration-200" class:rotate-180={showProfileMenu} style="color: oklch(0.6 0.02 180);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{#if showProfileMenu}
						<div class="profile-dropdown">
							<a href="/profile" class="dropdown-item" onclick={() => (showProfileMenu = false)}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
								โปรไฟล์
							</a>
							<div class="dropdown-divider"></div>
							<form method="POST" action="/logout" class="dropdown-form">
								<button type="submit" class="dropdown-item logout">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
									ออกจากระบบ
								</button>
							</form>
						</div>
					{/if}
				</div>
			</div>
		</header>

		<!-- Main content -->
		<main class="flex-1 overflow-y-auto" style="padding: clamp(16px, 2vw, 28px);">
			<div class="mx-auto max-w-7xl animate-in">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<Toast />
<DevTool user={data.user} />

<style>
	.profile-container { position: relative; }

	.profile-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		width: 200px;
		background: oklch(0.995 0.002 180);
		border: 1px solid oklch(0.92 0.005 180);
		border-radius: 12px;
		box-shadow: 0 12px 32px oklch(0.15 0.02 180 / 0.12);
		z-index: 9999;
		overflow: hidden;
		animation: dropdown-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 16px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.35 0.02 180);
		text-decoration: none;
		border: none;
		background: none;
		cursor: pointer;
		font-family: 'Noto Sans Thai', sans-serif;
		transition: background 0.1s ease;
	}
	.dropdown-item:hover { background: oklch(0.97 0.005 240); }
	.dropdown-item svg { width: 16px; height: 16px; color: oklch(0.55 0.03 180); flex-shrink: 0; }
	.dropdown-item.logout { color: oklch(0.55 0.18 25); }
	.dropdown-item.logout svg { color: oklch(0.55 0.18 25); }
	.dropdown-item.logout:hover { background: oklch(0.58 0.2 25 / 0.06); }
	.dropdown-divider { height: 1px; background: oklch(0.92 0.005 180); margin: 4px 0; }
	.dropdown-form { display: contents; }

	.rotate-180 { transform: rotate(180deg); }

	@keyframes dropdown-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
</style>
