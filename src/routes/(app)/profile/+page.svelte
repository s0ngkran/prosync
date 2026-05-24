<script lang="ts">
	import { enhance } from '$app/forms';
	import { watchFormResult } from '$lib/stores/toast.svelte';

	let { data, form: formResult } = $props();

	watchFormResult(() => formResult);
	let isEditing = $state(false);
	let editName = $state(data.profile.name);
	let editPosition = $state(data.profile.position || '');
	let editPositionRank = $state(data.profile.position_rank || '');
	let editEmail = $state(data.profile.email || '');
	let editPhone = $state(data.profile.phone || '');

	let canEditRank = $derived(!data.user.is_director && !data.user.is_super_admin);
	let showChangePassword = $state(false);
	let showOld = $state(false);
	let showNew = $state(false);
	let showConfirm = $state(false);

	function startEdit() {
		editName = data.profile.name;
		editPosition = data.profile.position || '';
		editPositionRank = data.profile.position_rank || '';
		editEmail = data.profile.email || '';
		editPhone = data.profile.phone || '';
		isEditing = true;
	}
</script>

<div class="profile">
	<!-- Toast notifications handled by global Toast component -->

	<!-- ======== HERO ======== -->
	<div class="hero">
		<div class="hero-bg"></div>
		<div class="hero-content">
			<div class="av-wrap">
				{#if data.profile.profile_picture}
					<img src={data.profile.profile_picture} alt="" class="av" />
				{:else}
					<div class="av av-ph">{data.profile.name.charAt(0)}</div>
				{/if}
				<form method="POST" action="?/uploadAvatar" enctype="multipart/form-data" use:enhance class="av-form">
					<label class="av-btn">
						<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" hidden
							onchange={(e) => (e.target as HTMLFormElement).form?.requestSubmit()} />
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
					</label>
				</form>
			</div>
			<div class="hero-text">
				<h1>{data.profile.name}</h1>
				<div class="hero-tags">
					{#if data.roleName}
						<span class="tag">{data.roleName}</span>
					{/if}
					{#if data.user.is_super_admin}
						<span class="tag tag-gold">Super Admin</span>
					{/if}
				</div>
				{#if data.agencyName}
					<p class="hero-sub">{data.agencyName}</p>
				{/if}
			</div>
			<div class="hero-contact">
				{#if data.profile.phone}
					<div class="contact-item">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
						{data.profile.phone}
					</div>
				{/if}
				{#if data.profile.email}
					<div class="contact-item">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
						{data.profile.email}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Action bar (between hero and cards) -->
	{#if !isEditing}
		<div class="action-bar">
			<button onclick={startEdit} class="btn-edit">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
				แก้ไขข้อมูลส่วนตัว
			</button>
		</div>
	{/if}

	<!-- ======== CARDS ======== -->
	<div class="grid">
		<!-- Personal -->
		<section class="card">
			<div class="card-top blue">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
				<span>ข้อมูลส่วนตัว</span>
			</div>
			<div class="card-body">
				{#if isEditing}
					<form method="POST" action="?/updateProfile" use:enhance={() => {
						return async ({ update }) => { isEditing = false; await update(); };
					}}>
						<div class="f-grid">
							<div class="f-row">
								<div class="f">
									<label for="e-pos">ยศ/คำนำหน้า</label>
									<input id="e-pos" name="position" bind:value={editPosition} placeholder="เช่น นาย, นพ." />
								</div>
								<div class="f">
									<label for="e-name">ชื่อ-นามสกุล</label>
									<input id="e-name" name="name" bind:value={editName} required />
								</div>
							</div>
							<div class="f">
								<label for="e-rank">ระดับตำแหน่ง</label>
								{#if canEditRank}
									<input id="e-rank" name="position_rank" bind:value={editPositionRank} placeholder="เช่น เจ้าพนักงานพัสดุชำนาญงาน" />
								{:else}
									<input id="e-rank" name="position_rank" value={data.profile.position_rank || ''} readonly class="ro" />
									<small>ผอ./รองผอ. แก้ไขได้โดย Super Admin เท่านั้น</small>
								{/if}
							</div>
							<div class="f-row">
								<div class="f">
									<label for="e-email">อีเมล</label>
									<input id="e-email" name="email" type="email" bind:value={editEmail} placeholder="email@example.com" />
								</div>
								<div class="f">
									<label for="e-phone">เบอร์โทร</label>
									<input id="e-phone" name="phone" bind:value={editPhone} placeholder="08x-xxx-xxxx" />
								</div>
							</div>
						</div>
						<div class="f-actions">
							<button type="button" class="btn-ghost" onclick={() => (isEditing = false)}>ยกเลิก</button>
							<button type="submit" class="btn-primary">บันทึกข้อมูล</button>
						</div>
					</form>
				{:else}
					<table class="info-table"><tbody>
						<tr><td>ยศ/คำนำหน้า</td><td>{data.profile.position || '—'}</td></tr>
						<tr><td>ชื่อ-นามสกุล</td><td>{data.profile.name}</td></tr>
						<tr><td>ระดับตำแหน่ง</td><td>{data.profile.position_rank || '—'}</td></tr>
						<tr><td>อีเมล</td><td>{data.profile.email || '—'}</td></tr>
						<tr><td>เบอร์โทร</td><td>{data.profile.phone || '—'}</td></tr>
					</tbody></table>
				{/if}
			</div>
		</section>

		<!-- Org -->
		<section class="card">
			<div class="card-top green">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
				<span>ข้อมูลองค์กร</span>
			</div>
			<div class="card-body">
				<table class="info-table"><tbody>
					<tr><td>เลขบัตรประชาชน</td><td class="mono">{data.profile.id_card}</td></tr>
					<tr><td>บทบาท</td><td>{data.roleName || '—'}</td></tr>
					<tr><td>หน่วยงาน</td><td>{data.agencyName || '—'}</td></tr>
					<tr><td>แผนก</td><td>{data.orgUnitName || '—'}</td></tr>
				</tbody></table>
				<p class="ro-note">ข้อมูลส่วนนี้ไม่สามารถแก้ไขได้ หากต้องการเปลี่ยนแปลงกรุณาติดต่อผู้ดูแลระบบ</p>
			</div>
		</section>
	</div>

	<!-- ======== CHANGE PASSWORD ======== -->
	<div class="grid" style="margin-top: 16px;">
		<section class="card" style="grid-column: 1 / -1;">
			<div class="card-top orange">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
				<span>เปลี่ยนรหัสผ่าน</span>
			</div>
			<div class="card-body">
				{#if showChangePassword}
					<form method="POST" action="?/changePassword" use:enhance={() => {
						return async ({ update, result }) => {
							if (result.type === 'success') showChangePassword = false;
							await update();
						};
					}}>
						<div class="f-grid">
							<div class="f">
								<label for="old_password">รหัสผ่านปัจจุบัน</label>
								<div class="pw-field">
									<input id="old_password" name="old_password" type={showOld ? 'text' : 'password'} required placeholder="กรอกรหัสผ่านปัจจุบัน" />
									<button type="button" class="pw-toggle" tabindex="-1" onclick={() => showOld = !showOld}>
										{#if showOld}ซ่อน{:else}แสดง{/if}
									</button>
								</div>
								{#if formResult?.errors?.old_password}
									<small class="err">{formResult.errors.old_password[0]}</small>
								{/if}
							</div>
							<div class="f-row">
								<div class="f">
									<label for="new_password">รหัสผ่านใหม่</label>
									<div class="pw-field">
										<input id="new_password" name="new_password" type={showNew ? 'text' : 'password'} required minlength="6" placeholder="อย่างน้อย 6 ตัวอักษร" />
										<button type="button" class="pw-toggle" tabindex="-1" onclick={() => showNew = !showNew}>
											{#if showNew}ซ่อน{:else}แสดง{/if}
										</button>
									</div>
									{#if (formResult?.errors as any)?.new_password}
										<small class="err">{(formResult.errors as any).new_password[0]}</small>
									{/if}
								</div>
								<div class="f">
									<label for="confirm_password">ยืนยันรหัสผ่านใหม่</label>
									<div class="pw-field">
										<input id="confirm_password" name="confirm_password" type={showConfirm ? 'text' : 'password'} required minlength="6" placeholder="กรอกรหัสผ่านอีกครั้ง" />
										<button type="button" class="pw-toggle" tabindex="-1" onclick={() => showConfirm = !showConfirm}>
											{#if showConfirm}ซ่อน{:else}แสดง{/if}
										</button>
									</div>
									{#if (formResult?.errors as any)?.confirm_password}
										<small class="err">{(formResult.errors as any).confirm_password[0]}</small>
									{/if}
								</div>
							</div>
						</div>
						<div class="f-actions">
							<button type="button" class="btn-ghost" onclick={() => (showChangePassword = false)}>ยกเลิก</button>
							<button type="submit" class="btn-primary">บันทึกรหัสผ่านใหม่</button>
						</div>
					</form>
				{:else}
					<div style="display: flex; align-items: center; justify-content: space-between;">
						<p style="margin: 0; font-size: .8125rem; color: #78909c;">คุณสามารถเปลี่ยนรหัสผ่านได้โดยกรอกรหัสผ่านปัจจุบัน</p>
						<button class="btn-edit" onclick={() => (showChangePassword = true)}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 15px; height: 15px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
							เปลี่ยนรหัสผ่าน
						</button>
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>

<style>
	.profile {
		max-width: 900px; margin: 0 auto;
		font-family: 'Noto Sans Thai', system-ui, sans-serif;
		animation: fadeUp .5s ease;
	}

	/* ========== HERO ========== */
	.hero {
		border-radius: 20px;
		overflow: hidden;
		margin-bottom: 16px;
		box-shadow: 0 2px 12px rgb(0 0 0 / .08);
		background: linear-gradient(135deg, #0a2d4f 0%, #0d3868 30%, #0f4c75 55%, #0b5e5a 75%, #094a42 100%);
	}
	.hero-bg { display: none; }
	.hero-content {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 20px;
		padding: 32px;
		position: relative;
	}

	/* avatar */
	.av-wrap { position: relative; flex-shrink: 0; }
	.av {
		width: 110px; height: 110px;
		border-radius: 50%;
		border: 5px solid #fff;
		box-shadow: 0 4px 24px rgb(13 59 102 / .25);
		object-fit: cover;
		background: #e3f2fd;
	}
	.av-ph {
		display: flex; align-items: center; justify-content: center;
		background: linear-gradient(135deg, #1565c0, #00897b);
		color: #fff;
		font-size: 2.75rem; font-weight: 800;
	}
	.av-form { position: absolute; bottom: 4px; right: 0; }
	.av-btn {
		display: flex; align-items: center; justify-content: center;
		width: 34px; height: 34px; border-radius: 50%;
		background: #fff; border: 2px solid #e0e0e0;
		box-shadow: 0 2px 8px rgb(0 0 0 / .12);
		cursor: pointer;
		transition: transform .15s, box-shadow .15s;
	}
	.av-btn:hover { transform: scale(1.08); box-shadow: 0 4px 14px rgb(0 0 0 / .18); }
	.av-btn svg { width: 16px; height: 16px; color: #1565c0; }

	/* hero text — sits ON the gradient */
	.hero-text { flex: 1; min-width: 180px; }
	.hero-text h1 {
		margin: 0;
		font-size: 1.75rem; font-weight: 800;
		color: #fff;
		text-shadow: 0 2px 8px rgb(0 0 0 / .2);
		letter-spacing: -0.01em;
	}
	.hero-tags { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
	.tag {
		padding: 3px 14px;
		border-radius: 100px;
		font-size: .7rem; font-weight: 600;
		background: rgba(255,255,255,.25);
		color: #fff;
		border: 1px solid rgba(255,255,255,.3);
	}
	.tag-gold {
		background: rgba(255,215,0,.2);
		border-color: rgba(255,215,0,.35);
		color: #ffd54f;
	}
	.hero-sub {
		margin: 6px 0 0;
		font-size: .8125rem;
		color: rgba(255,255,255,.9);
	}

	/* contact items */
	.hero-contact {
		display: flex; flex-direction: column; gap: 6px;
		flex-shrink: 0; margin-left: auto;
	}
	.contact-item {
		display: flex; align-items: center; gap: 6px;
		font-size: .8rem; color: rgba(255,255,255,.95);
	}
	.contact-item svg { width: 15px; height: 15px; opacity: .85; flex-shrink: 0; }

	/* ========== ACTION BAR ========== */
	.action-bar {
		display: flex; justify-content: flex-end;
		margin-bottom: 16px;
	}
	.btn-edit {
		display: inline-flex; align-items: center; gap: 6px;
		padding: 8px 20px; border-radius: 10px;
		background: #fff; border: 1px solid #e0e6ed;
		color: #1565c0; font-size: .8125rem; font-weight: 600;
		cursor: pointer; font-family: inherit;
		box-shadow: 0 1px 4px rgb(0 0 0 / .06);
		transition: background .15s, border-color .15s, box-shadow .15s, transform .15s;
	}
	.btn-edit:hover {
		background: #e3f2fd; border-color: #90caf9;
		box-shadow: 0 3px 12px rgba(21,101,192,.12);
		transform: translateY(-1px);
	}
	.btn-edit svg { width: 15px; height: 15px; }

	/* ========== CARDS ========== */
	.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
	.card {
		background: #fff; border-radius: 16px;
		box-shadow: 0 1px 3px rgb(0 0 0 / .05), 0 4px 16px rgb(0 0 0 / .03);
		overflow: hidden;
	}
	.card-top {
		display: flex; align-items: center; gap: 10px;
		padding: 16px 22px;
		font-size: 1.0625rem; font-weight: 700; color: #fff;
	}
	.card-top svg { width: 22px; height: 22px; }
	.card-top span { flex: 1; }
	.card-top.blue { background: linear-gradient(135deg, #1565c0, #1976d2, #2196f3); }
	.card-top.green { background: linear-gradient(135deg, #00695c, #00897b, #009688); }
	.card-top.orange { background: linear-gradient(135deg, #e65100, #f57c00, #ff9800); }

	.card-body { padding: 20px; }

	.ro-note {
		margin: 16px 0 0; padding: 10px 14px; border-radius: 8px;
		background: #f5f7fa; font-size: .75rem; color: #90a4ae;
		text-align: center; line-height: 1.5;
	}

	/* info table */
	.info-table { width: 100%; border-collapse: collapse; }
	.info-table tr + tr td { border-top: 1px solid #f0f2f5; }
	.info-table td { padding: 11px 0; font-size: .8125rem; vertical-align: baseline; }
	.info-table td:first-child { color: #78909c; width: 40%; padding-right: 12px; }
	.info-table td:last-child { font-weight: 500; color: #263238; text-align: right; }
	.info-table .mono { font-family: 'SF Mono', 'Cascadia Code', monospace; letter-spacing: .5px; }

	/* form */
	.f-grid { display: flex; flex-direction: column; gap: 14px; }
	.f-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.f { display: flex; flex-direction: column; gap: 4px; }
	.f label { font-size: .8125rem; font-weight: 500; color: #546e7a; }
	.f input {
		padding: 9px 14px; border-radius: 10px;
		border: 1.5px solid #cfd8dc;
		font-family: inherit; font-size: .875rem;
		color: #263238; background: #fafbfc;
		transition: border-color .15s, box-shadow .15s;
	}
	.f input:focus { outline: none; border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,.1); }
	.f input.ro { background: #eceff1; color: #90a4ae; cursor: not-allowed; }
	.f small { font-size: .6875rem; color: #90a4ae; }
	.f small.err { color: #e53935; }

	.pw-field { position: relative; }
	.pw-field input { width: 100%; padding-right: 52px; }
	.pw-toggle {
		position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
		padding: 4px 8px; border: none; background: none;
		font-size: .7rem; color: #78909c; cursor: pointer;
		font-family: inherit; border-radius: 4px;
	}
	.pw-toggle:hover { background: #eceff1; color: #455a64; }

	.f-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
	.btn-ghost {
		padding: 8px 18px; border-radius: 8px; border: none;
		background: none; color: #78909c;
		font-size: .8125rem; font-weight: 500;
		cursor: pointer; font-family: inherit;
	}
	.btn-ghost:hover { background: #f5f5f5; }
	.btn-primary {
		padding: 8px 22px; border-radius: 8px; border: none;
		background: linear-gradient(135deg, #1565c0, #1976d2);
		color: #fff; font-size: .8125rem; font-weight: 600;
		cursor: pointer; font-family: inherit;
		box-shadow: 0 2px 8px rgba(25,118,210,.25);
		transition: transform .15s, box-shadow .15s;
	}
	.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(25,118,210,.3); }

	@keyframes fadeUp {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (max-width: 768px) {
		.hero-content { flex-direction: column; align-items: center; text-align: center; padding: 0 20px 24px; }
		.hero-contact { margin-left: 0; align-items: center; }
		.hero-tags { justify-content: center; }
		.grid { grid-template-columns: 1fr; }
		.f-row { grid-template-columns: 1fr; }
	}
</style>
