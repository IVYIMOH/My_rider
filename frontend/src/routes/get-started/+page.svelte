<script lang="ts">
	import { goto } from '$app/navigation';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MapWrapper from '$lib/components/MapWrapper.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PhoneLoginForm from '$lib/components/PhoneLoginForm.svelte';
	import { getPricing, createRide, getRide, cancelRide, startConversation } from '$lib/api';
	import { isAuthenticated } from '$lib/auth';
	import { ApiError } from '$lib/http';
	import type { PricingConfig, Ride, VehicleClass } from '$lib/api';

	// Svelte 5 states to manage user flow step-by-step
	let flowStep = $state('empty'); // 'empty' | 'select_vehicle' | 'requested'
	let selectedVehicle = $state('car');
	let activeTab = $state('home');
	let requesting = $state(false);
	let requestError = $state<string | null>(null);
	let phoneStep = $state(false);

	// The active ride request and its live status (polled while searching/active).
	let currentRideId = $state<number | null>(null);
	let currentRide = $state<Ride | null>(null);

	let vehicleClasses = $state<VehicleClass[]>([]);
	let config = $state<PricingConfig | null>(null);
	let pricingLoading = $state(true);
	let pricingError = $state<string | null>(null);
	let pricingErrorCode = $state('');

	// Local place picker. Coordinates are stored per place so the rider app
	// never needs the map key to calculate a route or submit a booking.
	interface Place {
		name: string;
		lat: number;
		lng: number;
	}

	const places: Place[] = [
		{ name: 'Sheraton Kampala Hotel', lat: 0.3476, lng: 32.5825 },
		{ name: 'Acacia Mall, Kololo', lat: 0.3345, lng: 32.5976 },
		{ name: 'Garden City Mall', lat: 0.328, lng: 32.5865 },
		{ name: 'Uganda National Museum', lat: 0.3356, lng: 32.5828 },
		{ name: 'Makerere University', lat: 0.3339, lng: 32.57 },
		{ name: 'Nakasero Market', lat: 0.318, lng: 32.573 },
		{ name: 'Kampala Railway Station', lat: 0.3212, lng: 32.5773 },
		{ name: 'Gaddafi National Mosque', lat: 0.3178, lng: 32.5816 },
		{ name: 'Kasubi Tombs', lat: 0.3345, lng: 32.5544 },
		{ name: 'Ntinda Shopping Centre', lat: 0.364, lng: 32.611 },
		{ name: 'Kira Road Police Station', lat: 0.355, lng: 32.599 },
		{ name: 'Munyonyo Speke Resort', lat: 0.229, lng: 32.626 },
		{ name: 'Ggaba Beach', lat: -0.012, lng: 32.618 },
		{ name: 'Kajjansi Airfield', lat: 0.198, lng: 32.535 },
		{ name: 'Entebbe Town', lat: 0.0512, lng: 32.4637 },
		{ name: 'Entebbe Airport Arrivals', lat: 0.0424, lng: 32.4435 },
		{ name: 'Entebbe Airport Departures', lat: 0.042, lng: 32.443 },
		{ name: 'Mukono Town', lat: 0.354, lng: 32.755 }
	];

	let pickup = $state<Place | null>(null);
	let destination = $state<Place | null>(null);
	let pickerFor = $state<'pickup' | 'destination' | null>(null);
	let placeSearch = $state('');
	let searchResults = $state<Place[]>(places);
	let searching = $state(false);
	let searchError = $state<string | null>(null);

	// Search places worldwide via OpenStreetMap Nominatim (no API key needed).
	$effect(() => {
		if (!pickerFor) return;
		const query = placeSearch.trim();
		if (query.length < 2) {
			searchResults = places;
			searching = false;
			searchError = null;
			return;
		}
		let cancelled = false;
		searching = true;
		searchError = null;
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(
					`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(query)}`,
					{ headers: { Accept: 'application/json' } }
				);
				if (!res.ok) throw new Error('Search failed');
				const data = (await res.json()) as Array<{
					display_name: string;
					lat: string;
					lon: string;
				}>;
				if (!cancelled) {
					searchResults = data.map((item) => ({
						name: item.display_name,
						lat: Number(item.lat),
						lng: Number(item.lon)
					}));
				}
			} catch {
				if (!cancelled) {
					searchError = 'Could not search places. Check your connection.';
					searchResults = [];
				}
			} finally {
				if (!cancelled) searching = false;
			}
		}, 450);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	function haversineKm(a: Place, b: Place): number {
		const R = 6371;
		const toRad = (d: number) => (d * Math.PI) / 180;
		const dLat = toRad(b.lat - a.lat);
		const dLng = toRad(b.lng - a.lng);
		const h =
			Math.sin(dLat / 2) ** 2 +
			Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
		return 2 * R * Math.asin(Math.sqrt(h));
	}

	const distanceKm = $derived(
		pickup && destination ? Math.max(0.1, haversineKm(pickup, destination)) : 0
	);
	const durationMin = $derived(distanceKm ? Math.max(1, Math.round((distanceKm / 40) * 60)) : 0);
	const routeMarkers = $derived([
		...(pickup ? [{ ...pickup, label: pickup.name, color: '#16a34a' }] : []),
		...(destination ? [{ ...destination, label: destination.name, color: '#f97316' }] : [])
	]);
	const routePath = $derived(pickup && destination ? [pickup, destination] : null);

	function openPicker(which: 'pickup' | 'destination') {
		placeSearch = '';
		searchResults = places;
		pickerFor = which;
	}

	function choosePlace(place: Place) {
		if (pickerFor === 'pickup') pickup = place;
		else if (pickerFor === 'destination') destination = place;
		pickerFor = null;
	}

	function saveDraft() {
		if (!pickup || !destination) {
			requestError = 'Select a source and destination first.';
			return;
		}
		try {
			const drafts = JSON.parse(localStorage.getItem('sipi_tourist_drafts') || '[]');
			drafts.push({
				id: Date.now().toString(),
				vehicleClassId: selectedVehicle,
				pickup: pickup.name,
				destination: destination.name,
				pickupLat: String(pickup.lat),
				pickupLng: String(pickup.lng),
				destLat: String(destination.lat),
				destLng: String(destination.lng),
				distanceKm,
				durationMin,
				createdAt: new Date().toISOString()
			});
			localStorage.setItem('sipi_tourist_drafts', JSON.stringify(drafts));
		} catch {
			// ignore storage errors
		}
		goto('/bookings');
	}

	function computeFare(vc: VehicleClass): number {
		if (!config) return 0;
		const raw =
			(config.baseFare + config.perKm * distanceKm + config.perMinute * durationMin) *
			vc.multiplier *
			config.bookingFee *
			config.surgeMultiplier;
		return Math.max(config.minimumFare, raw);
	}

	const fareFor = $derived.by(() => {
		const map = new Map<string, number>();
		for (const vc of vehicleClasses) map.set(vc.id, computeFare(vc));
		return map;
	});

	const currency = $derived(config?.currency ?? 'USD');

	function formatMoney(value: number): string {
		return new Intl.NumberFormat('en', {
			style: 'currency',
			currency,
			minimumFractionDigits: 2
		}).format(value);
	}

	async function loadPricing() {
		pricingLoading = true;
		pricingError = null;
		pricingErrorCode = '';
		try {
			const data = await getPricing();
			config = data.config;
			vehicleClasses = data.vehicleClasses;
		} catch (e) {
			pricingError = (e as Error).message;
			pricingErrorCode = e instanceof ApiError ? e.code : '';
		} finally {
			pricingLoading = false;
		}
	}

	$effect(() => {
		loadPricing();
	});

	async function confirmRequest() {
		if (!pickup || !destination) {
			requestError = 'Select a source and destination first.';
			return;
		}
		if (!isAuthenticated()) {
			phoneStep = true;
			return;
		}
		requesting = true;
		requestError = null;
		try {
			const ride = await createRide({
				vehicleClassId: selectedVehicle,
				pickup: pickup.name,
				destination: destination.name,
				pickupLat: pickup.lat,
				pickupLng: pickup.lng,
				destLat: destination.lat,
				destLng: destination.lng,
				distanceKm,
				durationMin
			});
			currentRideId = ride.id;
			currentRide = ride;
			flowStep = 'requested';
		} catch (e) {
			requestError = (e as Error).message;
		} finally {
			requesting = false;
		}
	}

	// While a ride request is on the board, poll its status so the rider sees
	// the driver get assigned (or the ride cancelled/completed) in near-real-time.
	$effect(() => {
		if (flowStep !== 'requested' || !currentRideId) return;
		const tick = async () => {
			try {
				currentRide = await getRide(currentRideId!);
			} catch {
				// transient polling error — keep the last known state
			}
		};
		tick();
		const timer = setInterval(tick, 5000);
		return () => clearInterval(timer);
	});

	async function cancelCurrentRide() {
		if (!currentRideId) return;
		requestError = null;
		try {
			currentRide = await cancelRide(currentRideId);
		} catch (e) {
			requestError = (e as Error).message;
		}
	}

	async function chatWithDriver() {
		const driver = currentRide?.driver;
		if (!driver) return;
		requestError = null;
		try {
			const convoId = await startConversation(driver.id, 'Hello! I just requested a ride with you.');
			goto(`/messages/${convoId}`);
		} catch (e) {
			requestError = (e as Error).message;
		}
	}

	function resetRequest() {
		flowStep = 'empty';
		currentRideId = null;
		currentRide = null;
		requestError = null;
	}
</script>

<div class="app-frame relative flex flex-col h-full bg-white overflow-hidden">

	<!-- Absolute Floating Map Container Interface Component -->
	<div class="w-full flex-1 relative min-h-0">
		<MapWrapper markers={routeMarkers} path={routePath} />

		<!-- Floating Top Header Card Overlay -->
		<div class="absolute top-4 inset-x-4 z-20 bg-white/90 backdrop-blur border border-border p-3 rounded-xl shadow-md flex items-center gap-3">
			<button type="button" class="text-text-muted hover:text-text-primary p-1 text-sm font-bold" onclick={() => goto('/')}>
				←
			</button>
			<div class="flex-1">
				<h2 class="text-caption font-bold uppercase tracking-wider text-text-muted">Current Target</h2>
				<p class="text-xs font-semibold text-text-primary truncate">Kampala District Exploration</p>
			</div>
			<Icon name="compass" size={18} class="text-primary-teal animate-spin" />
		</div>

		<!-- CONDITIONAL SCREEN WORKSPACE LAYERS -->
		{#if flowStep === 'empty'}
			<!-- CASE A: Empty Trip State Modal Box Overlay -->
			<div class="absolute bottom-4 inset-x-4 z-20 bg-white/95 backdrop-blur p-5 rounded-2xl shadow-xl border border-border text-center flex flex-col items-center">
				<div class="w-12 h-12 bg-light-teal text-deep-teal rounded-full flex items-center justify-center text-xl mb-2">
					<Icon name="clock" size={24} class="text-primary-teal" />
				</div>
				<h3 class="text-body-lg font-semibold text-text-primary">No active ride request</h3>
				<p class="text-caption text-text-muted mt-1 max-w-[200px]">Book a trusted taxi association driver right now.</p>
				{#if requestError}
					<p class="mt-2 rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-700">{requestError}</p>
				{/if}
				<button
					type="button"
					class="btn-primary mt-4 py-2.5 text-xs tracking-wide uppercase font-bold"
					onclick={() => flowStep = 'select_vehicle'}
				>
					Request a Driver
				</button>
			</div>

		{:else if flowStep === 'select_vehicle'}
			<!-- CASE B: Request Configurator Screen Tray Panel -->
			<div class="absolute inset-x-0 bottom-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border-t border-border p-5 flex flex-col max-h-[80%] overflow-y-auto no-scrollbar">
				<div class="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>

				<!-- Heading Row -->
				<div class="flex items-center justify-between mb-3 shrink-0">
					<h3 class="text-caption font-bold uppercase tracking-wider text-text-muted">Select Vehicle</h3>
					<button type="button" class="text-caption text-primary-teal font-semibold hover:underline" onclick={() => flowStep = 'empty'}>Cancel</button>
				</div>

				<!-- Grid Selection Array Layout Matrix -->
				{#if pricingLoading}
					<div class="mb-4 grid grid-cols-2 gap-2.5 shrink-0">
						{#each Array(4) as _}
							<div class="h-24 animate-pulse rounded-xl bg-slate-100"></div>
						{/each}
					</div>
				{:else if pricingError}
					<div class="mb-4 shrink-0 rounded-xl border border-red-200 bg-red-50 p-3.5 text-caption font-medium text-red-700">
						<p>Could not load fares: {pricingError}</p>
						<button type="button" class="mt-2 font-semibold underline underline-offset-2" onclick={loadPricing}>Try again</button>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-2.5 mb-4 shrink-0">
						{#each vehicleClasses as item}
							<button
								type="button"
								onclick={() => selectedVehicle = item.id}
								class="p-3 border text-left rounded-xl transition-all duration-200 flex flex-col justify-between h-24
								{selectedVehicle === item.id ? 'border-primary-teal bg-light-teal ring-1 ring-primary-teal/20' : 'border-border bg-white hover:bg-slate-50'}"
							>
								<div class="flex justify-between items-start w-full">
									<span class="font-bold text-xs text-text-primary">{item.name}</span>
									<span class="text-[10px] font-semibold opacity-70 {selectedVehicle === item.id ? 'text-deep-teal' : 'text-text-muted'}">&times;{item.multiplier}</span>
								</div>
								<div>
									<div class="text-[10px] text-text-muted font-medium">{item.seats}</div>
									<div class="text-xs font-bold text-text-primary mt-0.5">{formatMoney(fareFor.get(item.id) ?? 0)}</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Route Parameter Node Selection Block -->
				<h3 class="text-caption font-bold uppercase tracking-wider text-text-muted mb-2 shrink-0">Source &amp; Destination</h3>
				<div class="border border-border rounded-xl divide-y divide-border text-xs text-text-primary mb-4 bg-slate-50 overflow-hidden shrink-0">
					<button type="button" class="w-full p-3 flex items-center justify-between text-left hover:bg-white" onclick={() => openPicker('pickup')}>
						<span class="font-medium truncate" class:text-text-muted={!pickup}>
							{pickup?.name ?? 'Select source'}
						</span>
						<Icon name="chevron" size={12} class="text-text-muted" />
					</button>
					<button type="button" class="w-full p-3 flex items-center justify-between text-left hover:bg-white" onclick={() => openPicker('destination')}>
						<span class="font-medium truncate" class:text-text-muted={!destination}>
							{destination?.name ?? 'Select destination'}
						</span>
						<Icon name="chevron" size={12} class="text-text-muted" />
					</button>
					{#if pickup && destination}
						<p class="p-3 text-center text-[11px] text-text-muted">
							~{distanceKm.toFixed(1)} km · {durationMin} min
						</p>
					{/if}
				</div>

				<!-- Fare Computation Calculation Summary Line Module -->
				<div class="flex items-center justify-between border-t border-slate-100 pt-3 mb-4 shrink-0">
					<div>
						<p class="text-caption font-semibold text-text-muted">Estimated Base Fare</p>
						<p class="text-[10px] text-text-muted/70">Calculated via active Admin config tokens</p>
					</div>
					<p class="text-lg font-bold text-text-primary">
						{pricingError || !pickup || !destination
							? '—'
							: formatMoney(fareFor.get(selectedVehicle) ?? 0)}
					</p>
				</div>

				{#if requestError}
					<div class="mb-4 shrink-0 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-caption font-medium text-red-700">
						{requestError}
					</div>
				{/if}

				{#if phoneStep}
					<div class="mb-4 shrink-0">
						<PhoneLoginForm
							role="tourist"
							title="Verify your phone to request"
							buttonLabel="Verify & request"
							onSuccess={() => {
								phoneStep = false;
								confirmRequest();
							}}
						/>
					</div>
				{:else}
					<!-- Primary Trigger Button Call Action -->
					<div class="flex gap-2 shrink-0">
						<button
							type="button"
							class="flex-1 rounded-xl border border-border bg-white py-3.5 text-xs font-bold uppercase tracking-wide text-text-primary hover:bg-slate-50 disabled:opacity-50"
							disabled={!pickup || !destination || pricingLoading || !!pricingError}
							onclick={saveDraft}
						>
							Save for later
						</button>
						<button
							type="button"
							class="btn-primary flex-1 py-3.5"
							disabled={!pickup || !destination || requesting || pricingLoading || !!pricingError}
							onclick={confirmRequest}
						>
							{requesting ? 'Requesting…' : 'Confirm Request'}
						</button>
					</div>
				{/if}
			</div>

		{:else if flowStep === 'requested'}
			<!-- CASE C: Live ride request status -->
			<div class="absolute bottom-4 inset-x-4 z-20 bg-white/95 backdrop-blur p-6 rounded-2xl shadow-xl border border-border text-center flex flex-col items-center">
				{#if currentRide?.status === 'completed'}
					<div class="w-12 h-12 bg-light-teal text-deep-teal rounded-full flex items-center justify-center text-xl mb-2">
						<Icon name="check" size={24} class="text-primary-teal" />
					</div>
					<h3 class="text-body-lg font-semibold text-text-primary">Trip complete</h3>
					<p class="text-caption text-text-muted mt-1 max-w-[220px]">
						Thanks for riding with a trusted local driver.
					</p>
				{:else if currentRide?.status === 'cancelled'}
					<div class="w-12 h-12 bg-slate-100 flex items-center justify-center text-xl mb-2 rounded-full">
						<Icon name="back" size={24} class="text-text-muted" />
					</div>
					<h3 class="text-body-lg font-semibold text-text-primary">Ride cancelled</h3>
					<p class="text-caption text-text-muted mt-1 max-w-[220px]">
						No problem. You can request another ride anytime.
					</p>
				{:else if currentRide?.status === 'active' && currentRide.driver}
					<div class="w-12 h-12 bg-light-teal text-deep-teal rounded-full flex items-center justify-center text-xl mb-2">
						<Icon name="car" size={24} class="text-primary-teal" />
					</div>
					<h3 class="text-body-lg font-semibold text-text-primary">Driver assigned</h3>
					<div class="mt-2 w-full card text-left">
						<p class="text-body-rg font-semibold text-text-primary">{currentRide.driver.name}</p>
						<p class="text-caption text-text-muted">
							{currentRide.driver.association ?? 'Verified driver'}
							{#if currentRide.driver.rating > 0} · ★ {currentRide.driver.rating.toFixed(1)}{/if}
						</p>
					</div>
					<p class="text-caption text-text-muted mt-2">
						{currentRide.pickup} → {currentRide.destination}
					</p>
					<button
						type="button"
						class="mt-3 w-full border border-primary-teal bg-light-teal text-deep-teal rounded-xl py-2.5 text-xs font-bold uppercase tracking-wide"
						onclick={chatWithDriver}
					>
						Chat with driver
					</button>
				{:else}
					<span class="mb-2 h-9 w-9 animate-spin rounded-full border-[3px] border-border border-t-primary-teal"></span>
					<h3 class="text-body-lg font-semibold text-text-primary">Looking for a driver…</h3>
					<p class="text-caption text-text-muted mt-1 max-w-[220px]">
						Connecting with trusted local drivers. Your fare is {formatMoney(fareFor.get(selectedVehicle) ?? 0)}.
					</p>
				{/if}

				{#if requestError}
					<p class="mt-2 rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-700">{requestError}</p>
				{/if}

				{#if currentRide && (currentRide.status === 'searching' || currentRide.status === 'active')}
					<button
						type="button"
						class="mt-4 w-full border border-border bg-white rounded-xl py-2.5 text-xs font-bold uppercase tracking-wide text-red-600"
						onclick={cancelCurrentRide}
					>
						Cancel ride
					</button>
				{:else if currentRide}
					<button
						type="button"
						class="btn-primary mt-4 py-2.5 text-xs tracking-wide uppercase font-bold"
						onclick={resetRequest}
					>
						Done
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if pickerFor}
		<button
			type="button"
			class="absolute inset-0 z-40 bg-black/40"
			aria-label="Close place picker"
			onclick={() => (pickerFor = null)}
		></button>
		<div class="absolute inset-x-0 bottom-0 z-50 flex max-h-[80%] flex-col rounded-t-3xl bg-white p-5 shadow-xl">
			<div class="mb-3 flex shrink-0 items-center justify-between">
				<h3 class="text-body-lg font-semibold text-text-primary">
					Choose {pickerFor === 'pickup' ? 'pickup' : 'destination'}
				</h3>
				<button type="button" class="text-text-muted hover:text-text-primary" onclick={() => (pickerFor = null)}>✕</button>
			</div>
			<input
				class="field-input mb-3 shrink-0"
				type="search"
				placeholder="Search anywhere in the world"
				bind:value={placeSearch}
			/>
			<div class="overflow-y-auto rounded-xl border border-border divide-y divide-border">
				{#if searching}
					<p class="p-4 text-center text-caption text-text-muted">Searching…</p>
				{:else if searchError}
					<p class="p-4 text-center text-caption text-red-600">{searchError}</p>
				{:else}
					{#each searchResults as place, i (place.name + i)}
						<button
							type="button"
							class="w-full p-3 text-left transition hover:bg-slate-50"
							onclick={() => choosePlace(place)}
						>
							<p class="truncate text-body-rg font-semibold text-text-primary">{place.name}</p>
							<p class="text-caption text-text-muted">{place.lat.toFixed(4)}, {place.lng.toFixed(4)}</p>
						</button>
					{:else}
						<p class="p-4 text-center text-caption text-text-muted">No places match.</p>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<BottomNav bind:activeTab />
</div>
