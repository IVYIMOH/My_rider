<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import PhoneGate from '$lib/components/PhoneGate.svelte';
	import { getRides, getAvailableDrivers, createRide, cancelRide } from '$lib/api';
	import { isAuthenticated } from '$lib/auth';
	import { ApiError } from '$lib/http';
	import type { Ride, AvailableDriver } from '$lib/api';

	let activeTab = $state('bookings');
	let rides = $state<Ride[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorCode = $state('');

	let drafts = $state<any[]>([]);

	let availableDrivers = $state<AvailableDriver[]>([]);
	let selectedDriverId = $state<number | null>(null);
	let driversLoading = $state(false);
	let driversError = $state<string | null>(null);
	let driversLoaded = $state(false);
	let showBio = $state(false);
	let bioDriver = $state<AvailableDriver | null>(null);
	let requestError = $state<string | null>(null);
	let requesting = $state(false);
	let rideAction = $state<number | null>(null);

	function loadDrafts() {
		try {
			drafts = JSON.parse(localStorage.getItem('sipi_tourist_drafts') || '[]');
		} catch {
			drafts = [];
		}
	}

	async function loadDrivers() {
		if (driversLoaded || driversLoading || drafts.length === 0) return;
		driversLoading = true;
		driversError = null;
		try {
			availableDrivers = await getAvailableDrivers();
			driversLoaded = true;
		} catch (e) {
			driversError = (e as Error).message;
		} finally {
			driversLoading = false;
		}
	}

	async function confirmDraft(draft: any) {
		if (requesting || !selectedDriverId) return;
		const selectedDriver = availableDrivers.find((d) => d.id === selectedDriverId);
		requesting = true;
		requestError = null;
		try {
			const ride = await createRide({
				vehicleClassId: draft.vehicleClassId,
				pickup: draft.pickup ?? `${draft.pickupLat}, ${draft.pickupLng}`,
				destination: draft.destination ?? `${draft.destLat}, ${draft.destLng}`,
				pickupLat: Number(draft.pickupLat),
				pickupLng: Number(draft.pickupLng),
				destLat: Number(draft.destLat),
				destLng: Number(draft.destLng),
				driverId: selectedDriver?.userId,
				distanceKm: Number(draft.distanceKm ?? 0),
				durationMin: Number(draft.durationMin ?? 0)
			});
			const next = drafts.filter((d) => d.id !== draft.id);
			localStorage.setItem('sipi_tourist_drafts', JSON.stringify(next));
			drafts = next;
			await load();
		} catch (e) {
			requestError = (e as Error).message;
		} finally {
			requesting = false;
		}
	}

	async function cancelRideFor(id: number) {
		rideAction = id;
		try {
			await cancelRide(id);
			await load();
		} catch (e) {
			requestError = (e as Error).message;
		} finally {
			rideAction = null;
		}
	}

	function deleteDraft(id: string) {
		try {
			const next = drafts.filter((d) => d.id !== id);
			localStorage.setItem('sipi_tourist_drafts', JSON.stringify(next));
			drafts = next;
		} catch {
			// ignore
		}
	}

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

	onMount(() => {
		if (!isAuthenticated()) {
			goto('/');
			return;
		}
		load();
		loadDrafts();
		if (drafts.length > 0) loadDrivers();
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

	function statusLabel(status: Ride['status']): string {
		switch (status) {
			case 'searching':
				return 'Finding driver';
			case 'active':
				return 'Driver assigned';
			case 'completed':
				return 'Completed';
			case 'cancelled':
				return 'Cancelled';
			default:
				return status;
		}
	}
</script>

<PhoneGate role="tourist" title="Sign in to view your bookings" onSuccess={load}>
	<div class="app-frame flex flex-col h-full bg-white relative">
		<TopBar title="My Bookings" onBack={() => history.back()} />

	<div class="flex-1 overflow-y-auto p-6">
		{#if drafts.length > 0}
			<div class="mb-4 space-y-3">
				<h2 class="text-h2 text-text-primary">Pending requests</h2>
				{#each drafts as draft (draft.id)}
					<div class="card space-y-3">
						<p class="text-caption text-text-muted">Saved {new Date(draft.createdAt).toLocaleString()}</p>
						<p class="text-body-rg font-semibold text-text-primary">
							{draft.pickup ?? `${draft.pickupLat}, ${draft.pickupLng}`} → {draft.destination ?? `${draft.destLat}, ${draft.destLng}`}
						</p>

						{#if driversLoading}
							<div class="space-y-2">
								{#each Array(3) as _}
									<div class="h-12 animate-pulse rounded-xl bg-slate-100"></div>
								{/each}
							</div>
						{:else if driversError}
							<div class="rounded-xl border border-red-200 bg-red-50 p-3 text-caption font-medium text-red-700">
								<p>{driversError}</p>
								<button type="button" class="mt-2 font-semibold underline underline-offset-2" onclick={loadDrivers}>Try again</button>
							</div>
						{:else if availableDrivers.length === 0}
							<p class="text-caption text-text-muted">No drivers available right now.</p>
						{:else}
							<div class="space-y-2 max-h-40 overflow-y-auto">
								{#each availableDrivers as d (d.id)}
									<label class="card flex items-center gap-3 cursor-pointer">
										<input type="radio" name="driver-{draft.id}" value={d.id} bind:group={selectedDriverId} class="h-4 w-4" />
										<div class="min-w-0 flex-1">
											<p class="text-body-rg font-semibold text-text-primary truncate">{d.name}</p>
											<p class="text-caption text-text-muted truncate">{d.association ?? 'Verified driver'} · ★ {d.rating.toFixed(1)}</p>
										</div>
										<button type="button" class="text-caption text-primary-teal font-semibold" onclick={() => { bioDriver = d; showBio = true; }}>View bio</button>
									</label>
								{/each}
							</div>
						{/if}

						{#if requestError}
							<p class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-caption font-medium text-red-700">{requestError}</p>
						{/if}

						<div class="flex gap-2">
							<button type="button" class="btn-primary flex-1 py-2" disabled={requesting || !selectedDriverId || availableDrivers.length === 0} onclick={() => confirmDraft(draft)}>
								{requesting ? 'Requesting…' : 'Select'}
							</button>
							<button type="button" class="border border-border bg-white rounded-xl px-4 py-2 text-caption font-semibold text-text-primary hover:bg-slate-50" onclick={() => deleteDraft(draft.id)}>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
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
							<span class="chip {statusClass(ride.status)}">{statusLabel(ride.status)}</span>
						</div>
						<div class="mt-2 flex items-center justify-between">
							<p class="text-body-lg font-semibold text-text-primary">{formatFare(ride.estimatedFare)}</p>
							<p class="text-caption text-text-muted">{ride.vehicleClassId} · {ride.createdAt.slice(0, 10)}</p>
						</div>
						{#if ride.status === 'searching' || ride.status === 'active'}
							<button
								type="button"
								class="mt-3 w-full border border-border bg-white rounded-xl py-2 text-xs font-bold uppercase tracking-wide text-red-600 hover:bg-red-50"
								disabled={rideAction === ride.id}
								onclick={() => cancelRideFor(ride.id)}
							>
								{rideAction === ride.id ? 'Cancelling…' : 'Cancel ride'}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if showBio && bioDriver}
		<button
			type="button"
			class="absolute inset-0 z-40 bg-black/40"
			aria-label="Close driver bio"
			onclick={() => (showBio = false)}
		></button>
		<div class="absolute inset-0 z-50 flex items-center justify-center p-6">
			<div class="card w-full max-w-sm space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="text-body-lg font-semibold text-text-primary">{bioDriver.name}</h3>
					<button type="button" class="text-text-muted hover:text-text-primary" onclick={() => (showBio = false)}>✕</button>
				</div>
				<p class="text-caption text-text-muted">{bioDriver.association ?? 'Verified driver'}</p>
				<p class="text-caption text-text-primary">Rating: ★ {bioDriver.rating.toFixed(1)}</p>
				<p class="text-caption text-text-primary">Phone: {bioDriver.phone ?? 'Not available'}</p>
				{#if bioDriver.location}
					<p class="text-caption text-text-muted">Location: {bioDriver.location.lat.toFixed(4)}, {bioDriver.location.lng.toFixed(4)}</p>
				{/if}
				<button type="button" class="btn-primary w-full" onclick={() => (showBio = false)}>Close</button>
			</div>
		</div>
	{/if}

	<BottomNav bind:activeTab />
	</div>
</PhoneGate>
