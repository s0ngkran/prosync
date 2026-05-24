<script lang="ts">
	import { enhance } from '$app/forms';
	import CustomSelect from '$lib/components/CustomSelect.svelte';

	let { data } = $props();

	let selectedProvince = $state(data.selectedProvinceId ? String(data.selectedProvinceId) : '');
	let selectedAgency = $state(data.selectedAgencyId ? String(data.selectedAgencyId) : '');
	let scopeForm: HTMLFormElement;

	function onProvinceChange(val: string) {
		selectedProvince = val;
		selectedAgency = '';
		scopeForm?.requestSubmit();
	}

	function onAgencyChange(val: string) {
		selectedAgency = val;
		scopeForm?.requestSubmit();
	}

	let agencyId = $derived(data.selectedAgencyId);
	let canManage = $derived((data as any).canManage ?? data.mode === 'super_admin');

	const allCards = [
		{
			title: 'จัดการสิทธิ์ผู้ใช้งาน',
			desc: 'ค้นหาผู้ใช้ มอบหมายบทบาท/แผนก กำหนดสังกัดหลัก',
			href: '/admin/users',
			icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
			accentColor: 'oklch(0.52 0.14 240)',
			accentBg: 'oklch(0.52 0.14 240 / 0.08)',
			requiresManage: true
		},
		{
			title: 'จัดการบทบาทและสิทธิ์',
			desc: 'สร้าง/แก้ไขบทบาท กำหนดสิทธิ์การเข้าถึงระบบ',
			href: '/admin/roles',
			icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
			accentColor: 'oklch(0.54 0.16 150)',
			accentBg: 'oklch(0.54 0.16 150 / 0.08)',
			requiresManage: true
		},
		{
			title: 'โครงสร้างองค์กร',
			desc: 'ดูแผนก หน่วยงาน และบุคลากรในองค์กร',
			href: '/admin/org-structure',
			icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
			accentColor: 'oklch(0.55 0.12 280)',
			accentBg: 'oklch(0.55 0.12 280 / 0.08)',
			requiresManage: false
		}
	];

	let cards = $derived(allCards.filter((c) => !c.requiresManage || canManage));
</script>

<div class="page-container">
	<!-- Header Banner -->
	<div class="page-banner">
		<div class="banner-content">
			<div class="banner-icon-wrap">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
				</svg>
			</div>
			<div>
				<h1 class="banner-title">จัดการโครงสร้างองค์กร</h1>
				<p class="banner-subtitle">จัดการผู้ใช้งาน สิทธิ์ บทบาท และโครงสร้างแผนก</p>
			</div>
		</div>
		<div class="banner-decoration"></div>
		<div class="banner-decoration-2"></div>
	</div>

	<!-- Scope Selector -->
	{#if data.mode === 'super_admin'}
		<form method="POST" action="?/selectScope" use:enhance bind:this={scopeForm} style="display:contents;">
			<input type="hidden" name="province_id" value={selectedProvince} />
			<input type="hidden" name="agency_id" value={selectedAgency} />
		</form>
		<div class="scope-bar">
			<div class="scope-field">
				<svg class="scope-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				<span class="scope-label">จังหวัด</span>
				<CustomSelect
					options={data.provinces.map((p: any) => ({ value: String(p.id), label: p.name }))}
					value={data.selectedProvinceId ? String(data.selectedProvinceId) : ''}
					placeholder="-- เลือกจังหวัด --"
					onchange={onProvinceChange}
					class="scope-select"
				/>
			</div>
			<div class="scope-divider"></div>
			<div class="scope-field">
				<svg class="scope-icon" class:scope-icon-disabled={!data.selectedProvinceId} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
				</svg>
				<span class="scope-label" class:disabled-label={!data.selectedProvinceId}>หน่วยงาน</span>
				<CustomSelect
					options={data.agencies.map((a: any) => ({ value: String(a.id), label: a.name }))}
					value={data.selectedAgencyId ? String(data.selectedAgencyId) : ''}
					placeholder={data.selectedProvinceId && data.agencies.length === 0
						? '-- ไม่มีหน่วยงานในจังหวัดนี้ --'
						: '-- เลือกหน่วยงาน --'}
					disabled={!data.selectedProvinceId}
					onchange={onAgencyChange}
					class="scope-select"
				/>
			</div>
		</div>
	{:else}
		<!-- Director badge -->
		<div class="director-banner">
			<svg class="director-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
			</svg>
			<div>
				<span class="director-label">หน่วยงานของคุณ</span>
				<span class="director-name">{data.agencyName}</span>
			</div>
		</div>
	{/if}

	<!-- Cards -->
	{#if agencyId}
		<div class="card-grid">
			{#each cards as card, i}
				<a href={card.href} class="nav-card" style="animation-delay: {i * 0.08}s;">
					<div class="card-icon-wrap" style="background: {card.accentBg};">
						<svg class="card-icon" style="color: {card.accentColor};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d={card.icon} />
						</svg>
					</div>
					<div class="card-body">
						<h3 class="card-title">{card.title}</h3>
						<p class="card-desc">{card.desc}</p>
					</div>
					<svg class="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</a>
			{/each}
		</div>
	{:else}
		<!-- Empty State -->
		<div class="empty-state">
			<div class="empty-visual">
				<div class="empty-circle c1"></div>
				<div class="empty-circle c2"></div>
				<div class="empty-icon-wrap">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
					</svg>
				</div>
			</div>
			<h3 class="empty-title">เลือกจังหวัดและหน่วยงาน</h3>
			<p class="empty-desc">กรุณาเลือกจังหวัดและหน่วยงานด้านบนเพื่อเริ่มจัดการโครงสร้างองค์กร</p>
			<div class="empty-steps">
				<div class="step">
					<div class="step-num">1</div>
					<span>เลือกจังหวัด</span>
				</div>
				<svg class="step-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
				<div class="step">
					<div class="step-num">2</div>
					<span>เลือกหน่วยงาน</span>
				</div>
				<svg class="step-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
				<div class="step">
					<div class="step-num">3</div>
					<span>จัดการข้อมูล</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1); }

	/* ── Banner ── */
	.page-banner {
		position: relative; overflow: hidden;
		padding: 24px 28px; margin-bottom: 20px; border-radius: 18px;
		background: linear-gradient(135deg, oklch(0.52 0.14 240), oklch(0.54 0.16 150));
		box-shadow: 0 6px 24px oklch(0.52 0.14 240 / 0.12);
	}

	.banner-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 16px; }

	.banner-icon-wrap {
		width: 48px; height: 48px; border-radius: 14px;
		background: oklch(0.98 0.005 180 / 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	}
	.banner-icon-wrap svg { width: 24px; height: 24px; color: oklch(0.98 0.005 180); }

	.banner-title { margin: 0 0 4px 0; font-size: clamp(1.375rem, 1.1rem + 0.7vw, 1.625rem); font-weight: 700; color: oklch(0.98 0.005 180); letter-spacing: -0.01em; }
	.banner-subtitle { margin: 0; font-size: 0.875rem; color: oklch(0.98 0.005 180 / 0.8); }

	.banner-decoration { position: absolute; top: -40px; right: -40px; width: 180px; height: 180px; border-radius: 50%; background: oklch(0.98 0.005 180 / 0.07); pointer-events: none; }
	.banner-decoration-2 { position: absolute; bottom: -60px; right: 80px; width: 120px; height: 120px; border-radius: 50%; background: oklch(0.98 0.005 180 / 0.05); pointer-events: none; }

	/* ── Scope Bar ── */
	.scope-bar {
		display: flex; align-items: center; gap: 20px;
		padding: 18px 24px; margin-bottom: 28px; border-radius: 14px;
		background: oklch(0.98 0.005 180); border: 1px solid oklch(0.9 0.005 180);
	}

	.scope-field { display: flex; align-items: center; gap: 10px; }
	.scope-icon { width: 20px; height: 20px; color: oklch(0.52 0.14 240); flex-shrink: 0; }
	.scope-icon-disabled { color: oklch(0.7 0.01 180); }
	.scope-divider { width: 1px; height: 28px; background: oklch(0.88 0.01 180); }
	.scope-label { font-size: 0.8125rem; font-weight: 500; color: oklch(0.4 0.02 180); white-space: nowrap; }
	.scope-label.disabled-label { color: oklch(0.7 0.01 180); }

	.scope-select {
		padding: 9px 16px; border: 1px solid oklch(0.82 0.015 180); border-radius: 10px;
		background: oklch(0.995 0.002 180); font-family: 'Noto Sans Thai', sans-serif;
		font-size: 0.875rem; color: oklch(0.25 0.02 180); cursor: pointer;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.scope-select:focus { outline: none; border-color: oklch(0.52 0.14 240); box-shadow: 0 0 0 3px oklch(0.52 0.14 240 / 0.12); }
	.scope-select.disabled-select { opacity: 0.5; cursor: not-allowed; }

	/* ── Director Banner ── */
	.director-banner {
		display: inline-flex; align-items: center; gap: 14px;
		padding: 16px 22px; margin-bottom: 28px; border-radius: 14px;
		background: oklch(0.52 0.14 240 / 0.06); border-left: 3px solid oklch(0.52 0.14 240);
	}
	.director-icon { width: 24px; height: 24px; color: oklch(0.52 0.14 240); flex-shrink: 0; }
	.director-banner div { display: flex; flex-direction: column; gap: 2px; }
	.director-label { font-size: 0.75rem; font-weight: 500; color: oklch(0.5 0.02 180); }
	.director-name { font-size: 1rem; font-weight: 600; color: oklch(0.25 0.02 180); }

	/* ── Cards ── */
	.card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }

	.nav-card {
		display: flex; align-items: center; gap: 16px;
		padding: 24px; border-radius: 16px;
		background: oklch(0.995 0.002 180); border: 1px solid oklch(0.92 0.005 180);
		text-decoration: none;
		animation: card-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
	}
	.nav-card:hover {
		transform: translateY(-3px);
		box-shadow: 0 8px 28px oklch(0.52 0.14 240 / 0.1);
		border-color: oklch(0.52 0.14 240 / 0.2);
	}

	.card-icon-wrap {
		width: 48px; height: 48px; border-radius: 14px;
		display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	}
	.card-icon { width: 24px; height: 24px; }
	.card-body { flex: 1; min-width: 0; }
	.card-title { margin: 0 0 4px 0; font-size: 1rem; font-weight: 600; color: oklch(0.2 0.02 180); }
	.card-desc { margin: 0; font-size: 0.8125rem; color: oklch(0.5 0.02 180); line-height: 1.4; }

	.card-arrow {
		width: 20px; height: 20px; color: oklch(0.7 0.01 180); flex-shrink: 0;
		transition: transform 0.2s ease, color 0.2s ease;
	}
	.nav-card:hover .card-arrow { transform: translateX(4px); color: oklch(0.52 0.14 240); }

	/* ── Empty State ── */
	.empty-state { display: flex; flex-direction: column; align-items: center; padding: 60px 24px; text-align: center; }

	.empty-visual { position: relative; width: 100px; height: 100px; margin-bottom: 24px; }
	.empty-circle { position: absolute; border-radius: 50%; }
	.empty-circle.c1 { inset: 0; background: oklch(0.52 0.14 240 / 0.06); animation: pulse-slow 3s ease infinite; }
	.empty-circle.c2 { inset: 12px; background: oklch(0.52 0.14 240 / 0.08); animation: pulse-slow 3s ease infinite 0.5s; }
	.empty-icon-wrap {
		position: absolute; inset: 24px; border-radius: 50%;
		background: oklch(0.52 0.14 240 / 0.1);
		display: flex; align-items: center; justify-content: center;
	}
	.empty-icon-wrap svg { width: 28px; height: 28px; color: oklch(0.52 0.14 240); }

	.empty-title { margin: 0 0 8px 0; font-size: 1.1875rem; font-weight: 600; color: oklch(0.25 0.02 180); }
	.empty-desc { margin: 0 0 28px 0; font-size: 0.875rem; color: oklch(0.5 0.02 180); max-width: 380px; line-height: 1.5; }

	.empty-steps { display: flex; align-items: center; gap: 12px; }
	.step {
		display: flex; align-items: center; gap: 8px; padding: 10px 16px;
		border-radius: 10px; background: oklch(0.98 0.005 180); border: 1px solid oklch(0.92 0.005 180);
		font-size: 0.8125rem; color: oklch(0.35 0.02 180);
	}
	.step-num {
		width: 22px; height: 22px; border-radius: 50%; background: oklch(0.52 0.14 240);
		color: oklch(0.98 0.005 180); display: flex; align-items: center; justify-content: center;
		font-size: 0.6875rem; font-weight: 600;
	}
	.step-arrow { width: 18px; height: 18px; color: oklch(0.65 0.01 180); }

	/* ── Animations ── */
	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes card-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
	@keyframes pulse-slow { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.7; } }

	@media (max-width: 768px) {
		.card-grid { grid-template-columns: 1fr; }
		.scope-bar { flex-direction: column; align-items: flex-start; gap: 14px; }
		.scope-divider { display: none; }
		.empty-steps { flex-direction: column; }
		.step-arrow { transform: rotate(90deg); }
	}
</style>
