<script>
	import StatusBar from '$lib/components/StatusBar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import GoogleMap from '$lib/components/GoogleMap.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let online = $state(true);

	const kampala = { lat: 0.3476, lng: 32.5825 };
	const rating = 4.7;
	const totalStars = 5;
</script>

<div class="app-frame">
	<StatusBar />

	<div class="flex items-center gap-2 px-6 pb-2 pt-1">
		<span class="h-2 w-2 rounded-full {online ? 'bg-success' : 'bg-text-muted'}"></span>
		<span class="text-body-lg font-semibold text-text-primary">
			{online ? "You're online" : "You're offline"}
		</span>
		<button
			role="switch"
			aria-checked={online}
            title="Toggle Online Status"
			onclick={() => (online = !online)}
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
		<GoogleMap
			center={kampala}
			zoom={12}
			markers={[{ lat: kampala.lat, lng: kampala.lng, label: 'Kampala' }]}
		/>
	</div>

	<div class="flex-1 overflow-y-auto px-6 pb-4 pt-4">
		<div class="card flex items-center gap-3">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-light-teal text-body-lg font-semibold text-deep-teal">
				PO
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-body-lg font-semibold text-text-primary">Peter Okello</p>
				<p class="truncate text-caption text-text-muted">Mbale Highway Drivers Group</p>
			</div>
			<span class="flex items-center gap-1 rounded-pill bg-light-teal px-2 py-1 text-caption font-semibold text-deep-teal">
				<Icon name="check" size={12} />
				Verified
			</span>
		</div>

		<div class="mt-3 grid grid-cols-3 gap-3">
			<div class="card py-3 text-center">
				<p class="text-caption text-text-muted">Today</p>
				<p class="mt-1 text-h2">$62.40</p>
			</div>
			<div class="card py-3 text-center">
				<p class="text-caption text-text-muted">Online</p>
				<p class="mt-1 text-h2">3h 24m</p>
			</div>
			<div class="card py-3 text-center">
				<p class="text-caption text-text-muted">Rating</p>
				<p class="mt-1 text-h2">4.7</p>
			</div>
		</div>

		<div class="card mt-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="text-h1">{rating}</span>
					<div class="flex text-primary-teal">
						{#each Array(totalStars) as _, i}
							<Icon name="star" size={16} class={i < Math.round(rating) ? 'text-primary-teal' : 'text-border'} />
						{/each}
					</div>
				</div>
				<span class="text-caption text-text-muted">0 ratings</span>
			</div>
			<p class="mt-2 text-caption text-text-muted">
				No ratings yet — complete a trip to collect your first one.
			</p>
		</div>
	</div>

	<BottomNav />
</div>