<script lang="ts">
	import { enhance } from '$app/forms';

	let { form: formResult } = $props();
	let errors = $derived((formResult?.errors ?? {}) as Record<string, string[]>);
	let loading = $state(false);
	let showNew = $state(false);
	let showConfirm = $state(false);
</script>

<svelte:head>
	<title>เปลี่ยนรหัสผ่าน | ProSync ERP</title>
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center">
	<div class="w-full" style="max-width: 28rem">
		<div class="rounded-xl p-6" style="background: white; border: 1px solid var(--color-slate-100); box-shadow: var(--shadow-md)">
			<!-- Header -->
			<div class="text-center">
				<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style="background: oklch(0.95 0.05 45)">
					<svg class="h-6 w-6" style="color: oklch(0.55 0.15 45)" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
					</svg>
				</div>
				<h1 class="mt-3 text-lg font-bold" style="color: var(--color-slate-900)">เปลี่ยนรหัสผ่าน</h1>
				<p class="mt-1 text-[0.8125rem]" style="color: var(--color-slate-500)">กรุณาตั้งรหัสผ่านใหม่เพื่อความปลอดภัย</p>
			</div>

			<!-- Form -->
			<form method="POST" use:enhance={() => {
				loading = true;
				return async ({ update }) => { loading = false; await update(); };
			}} class="mt-5 space-y-4">
				<div>
					<label for="new_password" class="block text-[0.8125rem] font-medium" style="color: var(--color-slate-700)">
						รหัสผ่านใหม่ <span style="color: var(--color-error)">*</span>
					</label>
					<div class="relative mt-1">
						<input id="new_password" name="new_password" type={showNew ? 'text' : 'password'} required minlength="6"
							placeholder="อย่างน้อย 6 ตัวอักษร"
							class="block w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none"
							style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
						<button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 p-1" tabindex="-1"
							onclick={() => showNew = !showNew}
							style="color: var(--color-slate-400)">
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								{#if showNew}
									<path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
								{:else}
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								{/if}
							</svg>
						</button>
					</div>
					{#if errors.new_password}
						<p class="mt-1 text-[0.75rem]" style="color: var(--color-error)">{errors.new_password[0]}</p>
					{/if}
				</div>

				<div>
					<label for="confirm_password" class="block text-[0.8125rem] font-medium" style="color: var(--color-slate-700)">
						ยืนยันรหัสผ่านใหม่ <span style="color: var(--color-error)">*</span>
					</label>
					<div class="relative mt-1">
						<input id="confirm_password" name="confirm_password" type={showConfirm ? 'text' : 'password'} required minlength="6"
							placeholder="กรอกรหัสผ่านอีกครั้ง"
							class="block w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none"
							style="border: 1px solid var(--color-slate-200); color: var(--color-slate-900); background: white" />
						<button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 p-1" tabindex="-1"
							onclick={() => showConfirm = !showConfirm}
							style="color: var(--color-slate-400)">
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								{#if showConfirm}
									<path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
								{:else}
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								{/if}
							</svg>
						</button>
					</div>
					{#if errors.confirm_password}
						<p class="mt-1 text-[0.75rem]" style="color: var(--color-error)">{errors.confirm_password[0]}</p>
					{/if}
				</div>

				<button type="submit" disabled={loading}
					class="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all duration-200"
					style="background: var(--color-brand-600)"
					onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-700)'; }}
					onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-600)'; }}>
					{#if loading}
						กำลังบันทึก...
					{:else}
						บันทึกรหัสผ่านใหม่
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>
