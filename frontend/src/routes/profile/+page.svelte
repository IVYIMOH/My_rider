<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { getProfile } from '$lib/api';
	import { ApiError } from '$lib/http';

	let activeTab = $state('profile');
	let name = $state('');
	let accountId = $state('');
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorCode = $state('');

	async function load() {
		loading = true;
		error = null;
		errorCode = '';
		try {
			const p = await getProfile();
			name = p.profile.name;
			accountId = `#${String(p.profile.id).padStart(5, '0')}`;
		} catch (e) {
			error = (e as Error).message;
			errorCode = e instanceof ApiError ? e.code : '';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	function initials(value: string) {
		return value
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}
</script>

<div class="app-frame flex flex-col h-full bg-white">
	<TopBar title="Account Profile" onBack={() => history.back()} />

	<div class="flex-1 p-6 space-y-4">
		{#if loading}
			<div class="h-24 animate-pulse rounded-2xl bg-slate-100"></div>
		{:else if error}
			<ErrorState message={error} code={errorCode} retry={load} />
		{:else}
			<div class="card flex items-center gap-4">
				<div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-lg font-bold text-text-primary">
					{initials(name)}
				</div>
				<div>
					<h2 class="text-body-lg font-semibold text-text-primary">{name}</h2>
					<p class="text-caption text-text-muted">Account ID: {accountId}</p>
				</div>
			</div>

			<div class="space-y-2">
				<button class="w-full card p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition" onclick={() => location.href = '/'}>
					<span class="text-body-rg text-text-primary font-medium">Switch Roles / Log out</span>
					<Icon name="chevron" size={14} class="text-text-muted" />
				</button>
			</div>
		{/if}
	</div>

	<BottomNav bind:activeTab />
</div>
