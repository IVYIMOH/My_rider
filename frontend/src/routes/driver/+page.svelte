<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MapWrapper from '$lib/components/MapWrapper.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import PhoneGate from '$lib/components/PhoneGate.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getDriverMe, setDriverOnline } from '$lib/api';
	import { isAuthenticated } from '$lib/auth';
	import { ApiError } from '$lib/http';
	import type { DriverMe } from '$lib/api';

	let online = $state(false);
	let data = $state<DriverMe | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorCode = $state('');

	const kampala = { lat: 0.3476, lng: 32.5825 };
	const totalStars = 5;

	async function load() {
		if (!isAuthenticated()) return;
		loading = true;
		error = null;
		errorCode = '';
		try {
			data = await getDriverMe();
			online = data.profile.online;
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

	function formatOnline(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}

	async function toggleOnline() {
		const next = !online;
		online = next;
		try {
			await setDriverOnline(next);
		} catch (e) {
			online = !next;
			error = (e as Error).message;
			errorCode = e instanceof ApiError ? e.code : '';
		}
	}

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}
</script>

<PhoneGate role="driver" title="Driver sign in" onSuccess={load}>
	<div class="app-frame">

		<div class="flex items-center gap-2 px-6 pb-2 pt-1">
		<span class="h-2 w-2 rounded-full {online ? 'bg-success' : 'bg-text-muted'}"></span>
		<span class="text-body-lg font-semibold text-text-primary">
			{online ? "You're online" : "You're offline"}
		</span>
		<button
			role="switch"
			aria-checked={online}
            title="Toggle Online Status"
			onclick={toggleOnline}
			class="ml-auto flex h-7 w-12 items-center rounded-pill p-0.5 transition {online
				? 'bg-primary-teal'
				: 'bg-border'}"
		>
			<span
				class="h-6 w-6 rounded-full bg-white shadow transition-transform {online
					? 'translate-x-5'
					: 'translate-x-0'}"
			></span>
		</button>
	</div>

	<div class="mx-6 h-56 overflow-hidden rounded-2xl">
		<MapWrapper
			center={kampala}
			zoom={12}
			markers={[{ lat: kampala.lat, lng: kampala.lng, label: 'Kampala' }]}
		/>
	</div>

	<div class="flex-1 overflow-y-auto px-6 pb-4 pt-4">
		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<div class="h-16 animate-pulse rounded-2xl bg-slate-100"></div>
				{/each}
			</div>
		{:else if error || !data}
			<ErrorState message={error ?? 'Driver profile not found.'} code={errorCode} retry={load} />
		{:else}
			<div class="card flex items-center gap-3">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-light-teal text-body-lg font-semibold text-deep-teal">
					{initials(data.profile.name)}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-body-lg font-semibold text-text-primary">{data.profile.name}</p>
					<p class="truncate text-caption text-text-muted">{data.profile.association ?? 'No association set'}</p>
				</div>
				{#if data.profile.verified}
					<span class="flex items-center gap-1 rounded-pill bg-light-teal px-2 py-1 text-caption font-semibold text-deep-teal">
						<Icon name="check" size={12} />
						Verified
					</span>
				{/if}
			</div>

			<div class="mt-3 grid grid-cols-3 gap-3">
				<div class="card py-3 text-center">
					<p class="text-caption text-text-muted">Today</p>
					<p class="mt-1 text-h2">${data.stats.todayEarnings.toFixed(2)}</p>
				</div>
				<div class="card py-3 text-center">
					<p class="text-caption text-text-muted">Online</p>
					<p class="mt-1 text-h2">{formatOnline(data.stats.onlineSeconds)}</p>
				</div>
				<div class="card py-3 text-center">
					<p class="text-caption text-text-muted">Rating</p>
					<p class="mt-1 text-h2">{data.stats.rating.toFixed(1)}</p>
				</div>
			</div>

			<div class="card mt-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="text-h1">{data.stats.rating.toFixed(1)}</span>
						<div class="flex text-primary-teal">
							{#each Array(totalStars) as _, i}
								<Icon name="star" size={16} class={i < Math.round(data.stats.rating) ? 'text-primary-teal' : 'text-border'} />
							{/each}
						</div>
					</div>
					<span class="text-caption text-text-muted">0 ratings</span>
				</div>
				<p class="mt-2 text-caption text-text-muted">
					No ratings yet — complete a trip to collect your first one.
				</p>
			</div>
		{/if}
	</div>

	<BottomNav />
	</div>
</PhoneGate>
