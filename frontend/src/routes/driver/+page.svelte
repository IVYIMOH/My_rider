<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MapWrapper from '$lib/components/MapWrapper.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import PhoneGate from '$lib/components/PhoneGate.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getDriverMe, setDriverOnline, getAvailableRides, getRides, acceptRide, completeRide } from '$lib/api';
	import { isAuthenticated } from '$lib/auth';
	import { ApiError } from '$lib/http';
	import type { DriverMe, Ride } from '$lib/api';

	let online = $state(false);
	let data = $state<DriverMe | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorCode = $state('');
	let activeTab = $state('home');

	let availableRides = $state<Ride[]>([]);
	let activeRide = $state<Ride | null>(null);
	let ridesLoading = $state(true);
	let ridesError = $state<string | null>(null);
	let rideAction = $state<number | null>(null);

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

	// Dispatch board: available ride requests + the driver's active ride,
	// polled so new requests and status changes show up automatically.
	// The board is now gated server-side on verified + online, so its 403s are
	// expected states rather than errors — surface them as guidance.
	let boardNotice = $state<string | null>(null);

	async function loadRides() {
		if (!isAuthenticated()) return;
		ridesLoading = true;
		ridesError = null;
		try {
			const mine = await getRides();
			activeRide = mine.find((r) => r.status === 'active') ?? null;

			try {
				availableRides = await getAvailableRides();
				boardNotice = null;
			} catch (e) {
				availableRides = [];
				const code = e instanceof ApiError ? e.code : '';
				if (code === 'DRIVER_OFFLINE' || code === 'DRIVER_NOT_VERIFIED' || code === 'DRIVER_PROFILE_MISSING') {
					boardNotice = (e as Error).message;
				} else {
					ridesError = (e as Error).message;
				}
			}
		} catch (e) {
			ridesError = (e as Error).message;
		} finally {
			ridesLoading = false;
		}
	}

	$effect(() => {
		loadRides();
		const timer = setInterval(loadRides, 5000);
		return () => clearInterval(timer);
	});

	async function handleAccept(id: number) {
		rideAction = id;
		ridesError = null;
		try {
			await acceptRide(id);
			await loadRides();
		} catch (e) {
			ridesError = (e as Error).message;
		} finally {
			rideAction = null;
		}
	}

	async function handleComplete(id: number) {
		rideAction = id;
		ridesError = null;
		try {
			await completeRide(id);
			await loadRides();
		} catch (e) {
			ridesError = (e as Error).message;
		} finally {
			rideAction = null;
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

			{#if activeRide}
				<div class="card mt-3 border-primary-teal/40 bg-light-teal">
					<div class="flex items-center justify-between">
						<p class="text-caption font-semibold uppercase tracking-wide text-text-muted">Active ride</p>
						<span class="chip chip-active">In progress</span>
					</div>
					<p class="mt-2 text-body-lg font-semibold text-text-primary">{activeRide.pickup} → {activeRide.destination}</p>
					<p class="mt-1 text-caption text-text-muted">
						${activeRide.estimatedFare.toFixed(2)} · {activeRide.vehicleClassId}
					</p>
					<button
						type="button"
						class="btn-primary mt-3 py-2.5 text-xs uppercase font-bold"
						disabled={rideAction === activeRide.id}
						onclick={() => handleComplete(activeRide!.id)}
					>
						{rideAction === activeRide.id ? 'Completing…' : 'Complete ride'}
					</button>
				</div>
			{/if}

			<div class="card mt-3">
				<div class="flex items-center justify-between">
					<p class="text-caption font-semibold uppercase tracking-wide text-text-muted">Available rides</p>
					{#if ridesLoading}
						<span class="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary-teal"></span>
					{/if}
				</div>
				{#if ridesError}
					<p class="mt-2 rounded-xl bg-red-50 px-3 py-2 text-caption font-medium text-red-700">{ridesError}</p>
				{:else if boardNotice}
					<p class="mt-2 text-caption text-text-muted">{boardNotice}</p>
				{:else if availableRides.length === 0}
					<p class="mt-2 text-caption text-text-muted">No ride requests right now.</p>
				{:else}
					<div class="mt-2 divide-y divide-border">
						{#each availableRides as r}
							<div class="flex items-center gap-3 py-3">
								<div class="min-w-0 flex-1">
									<p class="truncate text-body-rg font-semibold text-text-primary">{r.pickup} → {r.destination}</p>
									<p class="text-caption text-text-muted">${r.estimatedFare.toFixed(2)} · {r.vehicleClassId}</p>
								</div>
								<button
									type="button"
									class="shrink-0 rounded-xl bg-deep-teal px-4 py-2 text-xs font-bold text-white"
									disabled={rideAction === r.id}
									onclick={() => handleAccept(r.id)}
								>
									{rideAction === r.id ? '…' : 'Accept'}
								</button>
							</div>
						{/each}
					</div>
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

	<BottomNav bind:activeTab />
	</div>
</PhoneGate>
