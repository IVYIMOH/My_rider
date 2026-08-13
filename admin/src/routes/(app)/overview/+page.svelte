<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { getDrivers, getUsers } from '$lib/api';
	import type { Driver, User } from '$lib/types';

	let drivers = $state<Driver[]>([]);
	let users = $state<User[]>([]);
	let loading = $state(true);

	$effect(() => {
		let cancelled = false;
		(async () => {
			const [d, u] = await Promise.all([getDrivers(), getUsers()]);
			if (!cancelled) {
				drivers = d;
				users = u;
				loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	const stats = $derived([
		{
			label: 'Tourists',
			value: users.filter((u) => u.role === 'Tourist').length,
			icon: 'person'
		},
		{ label: 'Drivers', value: drivers.length, icon: 'car' },
		{
			label: 'Pending approvals',
			value:
				users.filter((u) => u.status === 'Pending').length +
				drivers.filter((d) => !d.verified).length,
			icon: 'clock'
		},
		{ label: 'Verified drivers', value: drivers.filter((d) => d.verified).length, icon: 'check' }
	]);

	const pendingDrivers = $derived(drivers.filter((d) => !d.verified));
	const pendingUsers = $derived(users.filter((u) => u.status === 'Pending'));

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2);
	}
</script>

{#if loading}
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each Array(4) as _}
			<div class="h-24 animate-pulse rounded-2xl bg-slate-100"></div>
		{/each}
	</div>
{:else}
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each stats as s}
			<div class="card">
				<div class="flex items-center gap-2 text-text-muted">
					<Icon name={s.icon} size={18} class="text-primary-teal" />
					<p class="text-caption font-semibold uppercase tracking-wide">{s.label}</p>
				</div>
				<p class="mt-2 text-h1 font-bold text-text-primary">{s.value}</p>
			</div>
		{/each}
	</div>

	<div class="mt-6 grid gap-4 lg:grid-cols-2">
		<div class="card">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-body-rg font-semibold text-text-primary">Needs attention</h2>
				<span class="chip chip-active">{pendingDrivers.length + pendingUsers.length}</span>
			</div>
			{#if pendingDrivers.length + pendingUsers.length === 0}
				<p class="py-6 text-center text-caption text-text-muted">All caught up — nothing awaiting review.</p>
			{:else}
				<div class="flex flex-col divide-y divide-border">
					{#each pendingDrivers as d}
						<a href="/drivers" class="flex items-center gap-3 py-2.5">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-light-teal text-caption font-semibold text-deep-teal"
							>
								{initials(d.name)}
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-body-rg font-semibold text-text-primary">{d.name}</p>
								<p class="truncate text-caption text-text-muted">Driver · awaiting verification</p>
							</div>
							<Icon name="chevron" size={14} class="text-text-muted" />
						</a>
					{/each}
					{#each pendingUsers as u}
						<a href="/users" class="flex items-center gap-3 py-2.5">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-caption font-semibold text-text-primary"
							>
								{initials(u.name)}
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-body-rg font-semibold text-text-primary">{u.name}</p>
								<p class="truncate text-caption text-text-muted">{u.role} · awaiting approval</p>
							</div>
							<Icon name="chevron" size={14} class="text-text-muted" />
						</a>
					{/each}
				</div>
			{/if}
		</div>

		<div class="card">
			<h2 class="mb-3 text-body-rg font-semibold text-text-primary">Latest members</h2>
			<div class="flex flex-col divide-y divide-border">
				{#each [...users].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 5) as u}
					<div class="flex items-center gap-3 py-2.5">
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-caption font-semibold text-text-primary"
						>
							{initials(u.name)}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-body-rg font-semibold text-text-primary">{u.name}</p>
							<p class="truncate text-caption text-text-muted">{u.role}</p>
						</div>
						<span class="chip {u.status === 'Active' ? 'chip-active' : ''}">{u.status}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
