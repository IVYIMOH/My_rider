<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import PhoneGate from '$lib/components/PhoneGate.svelte';
	import { getRides } from '$lib/api';
	import { isAuthenticated } from '$lib/auth';
	import { ApiError } from '$lib/http';
	import type { Ride } from '$lib/api';

	let activeTab = $state('bookings');
	let rides = $state<Ride[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorCode = $state('');

	async function load() {
		if (!isAuthenticated()) return;
		loading = true;
		error = null;
		errorCode = '';
		try {
			rides = await getRides();
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

	function formatFare(fare: number): string {
		return `$${fare.toFixed(2)}`;
	}

	function statusClass(status: Ride['status']): string {
		switch (status) {
			case 'completed':
				return 'chip-active';
			case 'cancelled':
				return '';
			default:
				return 'bg-light-teal text-deep-teal font-semibold';
		}
	}
</script>

<PhoneGate role="tourist" title="Sign in to view your bookings" onSuccess={load}>
	<div class="app-frame flex flex-col h-full bg-white">
		<TopBar title="My Bookings" onBack={() => history.back()} />

	<div class="flex-1 overflow-y-auto p-6">
		{#if loading}
			<div class="space-y-3">
				{#each Array(2) as _}
					<div class="h-20 animate-pulse rounded-2xl bg-slate-100"></div>
				{/each}
			</div>
		{:else if error}
			<ErrorState message={error} code={errorCode} retry={load} />
		{:else if rides.length === 0}
			<div class="flex flex-col items-center justify-center py-14 text-center">
				<div class="w-14 h-14 bg-light-teal text-deep-teal rounded-full flex items-center justify-center text-xl mb-3">
					<Icon name="calendar" size={24} class="text-primary-teal" />
				</div>
				<h2 class="text-body-lg font-semibold text-text-primary">No upcoming rides</h2>
				<p class="text-caption text-text-muted mt-1 max-w-[220px]">Your scheduled and historical taxi association rides will appear here.</p>
			</div>
		{:else}
			<div class="flex flex-col gap-3">
				{#each rides as ride}
					<div class="card">
						<div class="flex items-center justify-between">
							<p class="text-caption font-semibold uppercase tracking-wide text-text-muted">
								{ride.pickup} → {ride.destination}
							</p>
							<span class="chip {statusClass(ride.status)}">{ride.status}</span>
						</div>
						<div class="mt-2 flex items-center justify-between">
							<p class="text-body-lg font-semibold text-text-primary">{formatFare(ride.estimatedFare)}</p>
							<p class="text-caption text-text-muted">{ride.vehicleClassId} · {ride.createdAt.slice(0, 10)}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<BottomNav bind:activeTab />
	</div>
</PhoneGate>
