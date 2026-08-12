<script lang="ts">
	import StatusBar from '$lib/components/StatusBar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let tab = $state('pricing');

	let pricing = $state({
		currency: 'USD',
		baseFare: 3,
		perKm: 1.2,
		perMinute: 0.15,
		bookingFee: 1,
		surgeMultiplier: 1,
		minimumFare: 5
	});

	const vehicleClasses = [
		{ name: 'Car / SUV', multiplier: 1 },
		{ name: 'Van / Minibus', multiplier: 1.25 },
		{ name: 'Coach bus', multiplier: 1.6 },
		{ name: 'Truck / 4x4 cargo', multiplier: 1.8 }
	];

	const drivers = [
		{ name: 'Peter Okello', group: 'Mbale Highway Drivers Group', verified: true, rating: 4.7 },
		{ name: 'Joseph Mwangi', group: 'Kampala Tourist Taxis Assoc.', verified: true, rating: 4.9 },
		{ name: 'Grace Alupo', group: 'Entebbe Airport Drivers Union', verified: false, rating: 4.8 }
	];

	const pendingUsers: Array<{ name: string; role: string }> = [];
	const users = [
		{ name: 'Amara Boateng', role: 'Tourist', status: 'Active' },
		{ name: 'David Kim', role: 'Tourist', status: 'Active' }
	];

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2);
	}
</script>

<div class="app-frame">
	<StatusBar />
	<div class="px-6 pb-2 pt-1 shrink-0">
		<h1 class="text-h1 text-text-primary">Admin panel</h1>
	</div>

	<!-- Statistics Row -->
	<div class="grid grid-cols-3 gap-3 px-6 shrink-0">
		<div class="card py-3 text-center">
			<p class="text-caption text-text-muted">Tourists</p>
			<p class="mt-1 text-h1 font-bold">1</p>
		</div>
		<div class="card py-3 text-center">
			<p class="text-caption text-text-muted">Drivers</p>
			<p class="mt-1 text-h1 font-bold">3</p>
		</div>
		<div class="card py-3 text-center">
			<p class="text-caption text-text-muted">Pending</p>
			<p class="mt-1 text-h1 font-bold">{pendingUsers.length}</p>
		</div>
	</div>

	<!-- Custom Segmented Tab Row Switcher -->
	<div class="mt-4 px-6 shrink-0">
		<div class="flex gap-1 rounded-xl bg-slate-100 p-1">
			{#each [['pricing', 'Pricing'], ['drivers', 'Drivers'], ['users', 'Users']] as [id, label]}
				<button
					type="button"
					class="flex-1 rounded-lg py-2 text-body-rg font-medium transition-all {tab === id
						? 'bg-white text-text-primary shadow-sm'
						: 'text-text-muted hover:text-text-primary'}"
					onclick={() => (tab = id)}
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Content Layer Panel Viewport -->
	<div class="flex-1 overflow-y-auto px-6 pb-4 pt-4 no-scrollbar">
		{#if tab === 'pricing'}
			<!-- Fixed from rounded-card to standard card with custom backgrounds -->
			<div class="card bg-deep-teal p-4 text-white border-transparent">
				<p class="text-caption font-semibold uppercase tracking-wide text-white/70">
					Driver-hire pricing formula
				</p>
				<p class="mt-1.5 text-body-rg font-medium leading-relaxed">
					(base + per-km &times; km + per-min &times; min) &times; vehicle class surge &times; booking fee
				</p>
			</div>

			<div class="mt-4 grid grid-cols-2 gap-3">
				<div>
					<label class="field-label" for="currency">Currency</label>
					<select id="currency" class="field-input py-2.5 text-sm" bind:value={pricing.currency}>
						<option>USD</option>
						<option>UGX</option>
						<option>KES</option>
					</select>
				</div>
				<div>
					<label class="field-label" for="baseFare">Base fare</label>
					<input id="baseFare" type="number" class="field-input" bind:value={pricing.baseFare} />
				</div>
				<div>
					<label class="field-label" for="perKm">Per km</label>
					<input id="perKm" type="number" step="0.1" class="field-input" bind:value={pricing.perKm} />
				</div>
				<div>
					<label class="field-label" for="perMinute">Per minute</label>
					<input
						id="perMinute"
						type="number"
						step="0.01"
						class="field-input"
						bind:value={pricing.perMinute}
					/>
				</div>
				<div>
					<label class="field-label" for="bookingFee">Booking fee</label>
					<input id="bookingFee" type="number" class="field-input" bind:value={pricing.bookingFee} />
				</div>
				<div>
					<label class="field-label" for="surge">Surge multiplier</label>
					<input
						id="surge"
						type="number"
						step="0.1"
						class="field-input"
						bind:value={pricing.surgeMultiplier}
					/>
				</div>
				<div class="col-span-2">
					<label class="field-label" for="minFare">Minimum fare</label>
					<input id="minFare" type="number" class="field-input" bind:value={pricing.minimumFare} />
				</div>
			</div>

			<div class="card mt-4">
				<p class="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
					Vehicle class rate multipliers
				</p>
				<div class="flex flex-col divide-y divide-border">
					{#each vehicleClasses as vc}
						<div class="flex items-center justify-between py-2.5">
							<span class="text-body-rg text-text-primary">{vc.name}</span>
							<span class="text-body-rg font-semibold text-deep-teal">&times;{vc.multiplier}</span>
						</div>
					{/each}
				</div>
			</div>

			<button type="button" class="btn-primary mt-5" onclick={() => alert('Pricing tokens saved successfully!')}>Save pricing</button>
		{:else if tab === 'drivers'}
			<div class="flex flex-col gap-3">
				{#each drivers as d}
					<div class="card flex items-center gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-light-teal text-caption font-semibold text-deep-teal"
						>
							{initials(d.name)}
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-1.5">
								<p class="truncate text-body-lg font-semibold text-text-primary">{d.name}</p>
								{#if d.verified}
									<span class="rounded-pill bg-light-teal px-1.5 py-0.5 text-[10px] font-semibold text-deep-teal">
										Verified
									</span>
								{/if}
							</div>
							<p class="truncate text-caption text-text-muted">{d.group}</p>
						</div>
						<div class="flex items-center gap-1 text-caption font-semibold text-text-primary">
							<Icon name="star" size={14} class="text-primary-teal" />
							{d.rating}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col gap-3">
				{#if pendingUsers.length === 0}
					<p class="mb-1 text-caption text-text-muted">No pending approvals.</p>
				{/if}
				{#each users as u}
					<div class="card flex items-center gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-caption font-semibold text-text-primary"
						>
							{initials(u.name)}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-body-lg font-semibold text-text-primary">{u.name}</p>
							<p class="text-caption text-text-muted">{u.role}</p>
						</div>
						<span class="chip chip-active">{u.status}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<BottomNav />
</div>
