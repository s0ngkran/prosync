<script lang="ts">
	let {
		committeeType,
		users = [],
		selected = [],
		onchange
	}: {
		committeeType: string;
		users: { id: number; name: string; position?: string }[];
		selected: { user_id: number; role_in_committee: string }[];
		onchange: (members: { user_id: number; role_in_committee: string }[]) => void;
	} = $props();

	let members = $state<{ user_id: number; role_in_committee: string }[]>(selected);
	let searchQuery = $state('');

	const roles = ['ประธาน', 'กรรมการ', 'เลขานุการ'];

	function addMember(userId: number) {
		if (members.some(m => m.user_id === userId)) return;
		members = [...members, { user_id: userId, role_in_committee: 'กรรมการ' }];
		onchange(members);
		searchQuery = '';
	}

	function removeMember(userId: number) {
		members = members.filter(m => m.user_id !== userId);
		onchange(members);
	}

	function updateRole(userId: number, role: string) {
		members = members.map(m => m.user_id === userId ? { ...m, role_in_committee: role } : m);
		onchange(members);
	}

	function getUserName(id: number) {
		return users.find(u => u.id === id)?.name ?? `User #${id}`;
	}

	let filteredUsers = $derived(
		users.filter(u =>
			!members.some(m => m.user_id === u.id) &&
			(!searchQuery.trim() || u.name.toLowerCase().includes(searchQuery.toLowerCase()))
		).slice(0, 8)
	);
</script>

<div>
	<p style="margin: 0 0 8px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: oklch(0.5 0.02 180)">
		คณะกรรมการ{committeeType}
	</p>

	<!-- Selected Members -->
	{#if members.length > 0}
		<div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px">
			{#each members as member}
				<div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; background: oklch(0.97 0.005 180)">
					<span style="flex: 1; font-size: 0.8125rem; color: oklch(0.3 0.02 180)">{getUserName(member.user_id)}</span>
					<select
						value={member.role_in_committee}
						onchange={(e) => updateRole(member.user_id, e.currentTarget.value)}
						style="padding: 3px 8px; border-radius: 6px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.6875rem; font-family: 'Noto Sans Thai', sans-serif"
					>
						{#each roles as role}
							<option value={role}>{role}</option>
						{/each}
					</select>
					<button type="button" onclick={() => removeMember(member.user_id)}
						style="width: 20px; height: 20px; border-radius: 50%; border: none; background: oklch(0.58 0.2 25 / 0.1); color: oklch(0.58 0.2 25); cursor: pointer; font-size: 0.625rem; display: flex; align-items: center; justify-content: center">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 10px; height: 10px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Search & Add -->
	<div style="position: relative">
		<input
			type="text"
			placeholder="ค้นหาชื่อบุคลากร..."
			bind:value={searchQuery}
			style="width: 100%; padding: 7px 12px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 180); font-size: 0.75rem; outline: none; font-family: 'Noto Sans Thai', sans-serif"
		/>
		{#if searchQuery.trim() && filteredUsers.length > 0}
			<div style="position: absolute; top: 100%; left: 0; right: 0; z-index: 10; margin-top: 4px; background: white; border: 1px solid oklch(0.88 0.01 180); border-radius: 8px; box-shadow: 0 8px 24px oklch(0.15 0.02 180 / 0.1); max-height: 200px; overflow-y: auto">
				{#each filteredUsers as user}
					<button type="button" onclick={() => addMember(user.id)}
						style="display: block; width: 100%; padding: 8px 12px; border: none; background: none; text-align: left; font-size: 0.75rem; color: oklch(0.3 0.02 180); cursor: pointer; font-family: 'Noto Sans Thai', sans-serif"
						onmouseenter={(e) => { e.currentTarget.style.background = 'oklch(0.97 0.005 180)'; }}
						onmouseleave={(e) => { e.currentTarget.style.background = 'none'; }}
					>
						{user.name}{user.position ? ` (${user.position})` : ''}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
