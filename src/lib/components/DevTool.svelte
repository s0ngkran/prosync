<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { user }: { user: any } = $props();

	let open = $state(false);
	let loading = $state(false);
	let devData = $state<any>(null);
	let selectedProvinceId = $state('');
	let selectedAgencyId = $state('');
	let selectedRoleId = $state('');
	let isImpersonating = $state(false);

	// Check if currently impersonating
	$effect(() => {
		isImpersonating = user?.name?.startsWith('[DEV]') ?? false;
	});

	async function loadDevData() {
		if (devData) return;
		loading = true;
		try {
			const res = await fetch('/api/dev-impersonate');
			devData = await res.json();
		} catch { /* ignore */ }
		loading = false;
	}

	function filteredAgencies() {
		if (!devData || !selectedProvinceId) return [];
		return devData.agencies.filter((a: any) => a.province_id === Number(selectedProvinceId));
	}

	async function impersonateRole() {
		if (!selectedRoleId || !selectedAgencyId) return;
		loading = true;
		const res = await fetch('/api/dev-impersonate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role_id: Number(selectedRoleId), agency_id: Number(selectedAgencyId) })
		});
		const data = await res.json();
		loading = false;
		if (data.ok) {
			open = false;
			location.reload();
		}
	}

	async function resetImpersonation() {
		loading = true;
		const res = await fetch('/api/dev-impersonate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ reset: true })
		});
		loading = false;
		open = false;
		location.reload();
	}
</script>

{#if user?.is_super_admin || isImpersonating}
	<!-- Impersonation Banner -->
	{#if isImpersonating}
		<div class="imp-banner">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
			<span>กำลังสวมบทบาท: <strong>{user.name}</strong></span>
			<button onclick={resetImpersonation} disabled={loading}>กลับเป็น Super Admin</button>
		</div>
	{/if}

	<!-- FAB Button -->
	<button class="dev-fab" class:fab-active={open} onclick={() => { open = !open; if (!devData) loadDevData(); }}
		title="Dev Tool">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
	</button>

	<!-- Panel -->
	{#if open}
		<div class="dev-panel">
			<div class="dev-header">
				<h3>Dev Tool</h3>
				<span class="dev-badge">Super Admin Only</span>
			</div>

			{#if loading && !devData}
				<p class="dev-loading">กำลังโหลด...</p>
			{:else if devData}
				<!-- Step 1: Province -->
				<div class="dev-section">
					<label class="dev-label">1. เลือกจังหวัด</label>
					<select bind:value={selectedProvinceId} class="dev-select" onchange={() => { selectedAgencyId = ''; }}>
						<option value="">-- เลือก --</option>
						{#each devData.provinces as p}
							<option value={String(p.id)}>{p.name}</option>
						{/each}
					</select>
				</div>

				<!-- Step 2: Agency -->
				{#if selectedProvinceId}
					<div class="dev-section">
						<label class="dev-label">2. เลือกหน่วยงาน</label>
						<select bind:value={selectedAgencyId} class="dev-select">
							<option value="">-- เลือก --</option>
							{#each filteredAgencies() as a}
								<option value={String(a.id)}>{a.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Step 3: Choose Role -->
				{#if selectedAgencyId}
					<div class="dev-divider"></div>

					<div class="dev-section">
						<label class="dev-label">3. เลือกบทบาท</label>
						<select bind:value={selectedRoleId} class="dev-select">
							<option value="">-- เลือก --</option>
							{#each devData.roles as r}
								<option value={String(r.id)}>{r.name}</option>
							{/each}
						</select>
						<button class="dev-btn blue" disabled={!selectedRoleId || loading} onclick={impersonateRole}>
							สวมบทบาท
						</button>
					</div>
				{/if}

				<!-- Reset -->
				{#if isImpersonating}
					<div class="dev-divider"></div>
					<button class="dev-btn red" onclick={resetImpersonation} disabled={loading}>
						กลับเป็น Super Admin
					</button>
				{/if}
			{/if}
		</div>
	{/if}
{/if}

<style>
	/* Impersonation Banner */
	.imp-banner {
		position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
		display: flex; align-items: center; justify-content: center; gap: 8px;
		padding: 6px 16px; background: #ff6f00; color: white;
		font-size: 0.8125rem; font-weight: 500;
	}
	.imp-banner svg { width: 16px; height: 16px; }
	.imp-banner button {
		padding: 3px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.5);
		background: rgba(255,255,255,0.15); color: white; font-size: 0.75rem; font-weight: 600;
		cursor: pointer;
	}
	.imp-banner button:hover { background: rgba(255,255,255,0.3); }

	/* FAB */
	.dev-fab {
		position: fixed; bottom: 20px; right: 20px; z-index: 9998;
		width: 48px; height: 48px; border-radius: 50%; border: none;
		background: linear-gradient(135deg, #ff6f00, #f57c00);
		color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
		box-shadow: 0 4px 16px rgba(255,111,0,0.35);
		transition: transform 0.2s, box-shadow 0.2s;
	}
	.dev-fab:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(255,111,0,0.45); }
	.dev-fab.fab-active { transform: rotate(90deg); }
	.dev-fab svg { width: 24px; height: 24px; }

	/* Panel */
	.dev-panel {
		position: fixed; bottom: 80px; right: 20px; z-index: 9998;
		width: 340px; max-height: calc(100vh - 120px); overflow-y: auto;
		background: white; border-radius: 16px; padding: 20px;
		box-shadow: 0 16px 48px rgba(0,0,0,0.15); border: 1px solid #e0e0e0;
		animation: panel-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.dev-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
	.dev-header h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #212121; }
	.dev-badge { padding: 2px 8px; border-radius: 6px; background: #fff3e0; color: #e65100; font-size: 0.6875rem; font-weight: 600; }

	.dev-loading { font-size: 0.8125rem; color: #9e9e9e; text-align: center; padding: 20px; }

	.dev-section { margin-bottom: 12px; }
	.dev-label { display: block; font-size: 0.75rem; font-weight: 600; color: #616161; margin-bottom: 4px; }
	.dev-select {
		width: 100%; padding: 8px 10px; border: 1px solid #e0e0e0; border-radius: 8px;
		font-size: 0.8125rem; color: #212121; background: #fafafa; margin-bottom: 6px;
	}
	.dev-select:focus { outline: none; border-color: #ff6f00; }

	.dev-btn {
		width: 100%; padding: 8px; border-radius: 8px; border: none;
		font-size: 0.8125rem; font-weight: 600; cursor: pointer;
		transition: opacity 0.15s;
	}
	.dev-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.dev-btn.blue { background: #1565c0; color: white; }
	.dev-btn.blue:hover:not(:disabled) { background: #0d47a1; }
	.dev-btn.red { background: #e53935; color: white; }
	.dev-btn.red:hover:not(:disabled) { background: #c62828; }

	.dev-divider { height: 1px; background: #eeeeee; margin: 14px 0; }


	@keyframes panel-in { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
</style>
