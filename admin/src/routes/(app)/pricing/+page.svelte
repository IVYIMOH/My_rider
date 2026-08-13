<script lang="ts">
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { getPricing, savePricing } from '$lib/api';
	import { ApiError } from '$lib/http';
	import type { PricingConfig, VehicleClass } from '$lib/types';

	let config = $state<PricingConfig>({
		currency: 'USD',
		baseFare: 3,
		perKm: 1.2,
		perMinute: 0.15,
		bookingFee: 1,
		surgeMultiplier: 1,
		minimumFare: 5
	});
	let vehicleClasses = $state<VehicleClass[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let loadError = $state<string | null>(null);
	let loadErrorCode = $state('');
	let saveError = $state<string | null>(null);

	async function load() {
		loading = true;
		loadError = null;
		loadErrorCode = '';
		try {
			const data = await getPricing();
			config = { ...data.config };
			vehicleClasses = data.vehicleClasses.map((v) => ({ ...v }));
		} catch (e) {
			loadError = (e as Error).message;
			loadErrorCode = e instanceof ApiError ? e.code : '';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function save() {
		saving = true;
		saved = false;
		saveError = null;
		try {
			await savePricing(config, vehicleClasses);
			saved = true;
			setTimeout(() => (saved = false), 2500);
		} catch (e) {
			saveError = (e as Error).message;
		} finally {
			saving = false;
		}
	}
</script>

<div class="card bg-deep-teal border-transparent p-4 text-white">
	<p class="text-caption font-semibold uppercase tracking-wide text-white/70">Driver-hire pricing formula</p>
	<p class="mt-1.5 text-body-rg font-medium leading-relaxed">
		(base + per-km &times; km + per-min &times; min) &times; vehicle class surge &times; booking fee
	</p>
</div>

{#if saved}
	<div
		class="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-caption font-medium text-success"
	>
		Pricing configuration saved successfully.
	</div>
{/if}

{#if saveError}
	<div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-caption font-medium text-red-700">
		{saveError}
	</div>
{/if}

{#if loading}
	<div class="mt-4 grid gap-4 lg:grid-cols-3">
		<div class="card lg:col-span-2">
			<div class="space-y-3">
				{#each Array(4) as _}
					<div class="h-11 animate-pulse rounded-xl bg-slate-100"></div>
				{/each}
			</div>
		</div>
		<div class="card">
			<div class="space-y-3">
				{#each Array(4) as _}
					<div class="h-10 animate-pulse rounded-xl bg-slate-100"></div>
				{/each}
			</div>
		</div>
	</div>
{:else if loadError}
	<ErrorState message={loadError} code={loadErrorCode} retry={load} />
{:else}
	<div class="mt-4 grid gap-4 lg:grid-cols-3">
		<form
			class="card lg:col-span-2"
			onsubmit={(e) => {
				e.preventDefault();
				save();
			}}
		>
			<p class="mb-4 text-caption font-semibold uppercase tracking-wide text-text-muted">Fare configuration</p>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label class="field-label" for="currency">Currency</label>
					<select id="currency" class="field-input py-2.5" bind:value={config.currency}>
						<option>USD</option>
						<option>UGX</option>
						<option>KES</option>
					</select>
				</div>
				<div>
					<label class="field-label" for="baseFare">Base fare</label>
					<input
						id="baseFare"
						type="number"
						step="0.01"
						class="field-input"
						bind:value={config.baseFare}
					/>
				</div>
				<div>
					<label class="field-label" for="perKm">Per km</label>
					<input id="perKm" type="number" step="0.01" class="field-input" bind:value={config.perKm} />
				</div>
				<div>
					<label class="field-label" for="perMinute">Per minute</label>
					<input
						id="perMinute"
						type="number"
						step="0.01"
						class="field-input"
						bind:value={config.perMinute}
					/>
				</div>
				<div>
					<label class="field-label" for="bookingFee">Booking fee</label>
					<input
						id="bookingFee"
						type="number"
						step="0.01"
						class="field-input"
						bind:value={config.bookingFee}
					/>
				</div>
				<div>
					<label class="field-label" for="surge">Surge multiplier</label>
					<input
						id="surge"
						type="number"
						step="0.1"
						class="field-input"
						bind:value={config.surgeMultiplier}
					/>
				</div>
				<div>
					<label class="field-label" for="minFare">Minimum fare</label>
					<input
						id="minFare"
						type="number"
						step="0.01"
						class="field-input"
						bind:value={config.minimumFare}
					/>
				</div>
			</div>

			<button type="submit" class="btn-primary mt-6" disabled={saving}>
				{#if saving}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
					Saving…
				{:else}
					Save pricing
				{/if}
			</button>
		</form>

		<div class="card">
			<p class="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
				Vehicle class rate multipliers
			</p>
			<div class="flex flex-col divide-y divide-border">
				{#each vehicleClasses as vc}
					<div class="flex items-center justify-between gap-3 py-2.5">
						<span class="text-body-rg text-text-primary">{vc.name}</span>
						<div class="flex items-center gap-2">
							<span class="text-caption text-text-muted">&times;</span>
							<input
								type="number"
								step="0.05"
								class="w-20 rounded-lg border border-border px-2 py-1.5 text-right text-body-rg font-semibold text-deep-teal outline-none transition focus:border-primary-teal"
								bind:value={vc.multiplier}
							/>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
