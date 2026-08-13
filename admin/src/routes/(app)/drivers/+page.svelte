<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { getDrivers, verifyDriver } from '$lib/api';
	import { ApiError } from '$lib/http';
	import type { Driver } from '$lib/types';

	let drivers = $state<Driver[]>([]);
	let loading = $state(true);
	let updating = $state<number | null>(null);
	let error = $state<string | null>(null);
	let errorCode = $state('');

	async function load() {
		loading = true;
		error = null;
		errorCode = '';
		try {
			drivers = await getDrivers();
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

	async function toggleVerify(d: Driver) {
		updating = d.id;
		const next = !d.verified;
		d.verified = next;
		try {
			await verifyDriver(d.id, next);
		} catch (e) {
			d.verified = !next;
			error = (e as Error).message;
			errorCode = e instanceof ApiError ? e.code : '';
		} finally {
			updating = null;
		}
	}

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2);
	}
</script>

{#if loading}
	<div class="grid gap-3">
		{#each Array(3) as _}
			<div class="h-20 animate-pulse rounded-2xl bg-slate-100"></div>
		{/each}
	</div>
{:else if error}
	<ErrorState message={error} code={errorCode} retry={load} />
{:else if drivers.length === 0}
	<div class="card flex flex-col items-center justify-center py-12 text-center">
		<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-light-teal text-deep-teal">
			<Icon name="car" size={22} class="text-primary-teal" />
		</div>
		<h2 class="text-body-lg font-semibold text-text-primary">No drivers yet</h2>
		<p class="mt-1 text-caption text-text-muted">Drivers who complete onboarding will appear here.</p>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#each drivers as d}
			<div class="card flex flex-col gap-3 sm:flex-row sm:items-center">
				<div
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-light-teal text-body-rg font-semibold text-deep-teal"
				>
					{initials(d.name)}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<p class="truncate text-body-lg font-semibold text-text-primary">{d.name}</p>
						{#if d.verified}
							<span
								class="rounded-full bg-light-teal px-1.5 py-0.5 text-[10px] font-semibold text-deep-teal"
							>
								Verified
							</span>
						{/if}
					</div>
					<p class="truncate text-caption text-text-muted">{d.group}</p>
					{#if d.phone}
						<p class="mt-0.5 text-caption text-text-muted">{d.phone}</p>
					{/if}
				</div>
				<div class="flex items-center gap-1 text-caption font-semibold text-text-primary">
					<Icon name="star" size={14} class="text-primary-teal" />
					{d.rating.toFixed(1)}
				</div>
				<button
					type="button"
					onclick={() => toggleVerify(d)}
					disabled={updating === d.id}
					class={d.verified
						? 'btn-secondary shrink-0 text-caption'
						: 'btn-primary shrink-0 text-caption'}
				>
					{#if updating === d.id}
						<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/40 border-t-current"></span>
					{:else if d.verified}
						Revoke verification
					{:else}
						Verify driver
					{/if}
				</button>
			</div>
		{/each}
	</div>
{/if}
