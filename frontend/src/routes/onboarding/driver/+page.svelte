<script lang="ts">
	import { goto } from '$app/navigation';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getVehicleClasses, submitDriverOnboarding } from '$lib/api';
	import { phoneLogin } from '$lib/auth';
	import { ApiError } from '$lib/http';
	import type { VehicleClass } from '$lib/api';

	let fullName = $state('');
	let phone = $state('');
	let association = $state('');
	let vehicleClassId = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	let vehicleClasses = $state<VehicleClass[]>([]);
	let loadingClasses = $state(true);
	let classesError = $state<string | null>(null);

	let submitted = $state(false);

	async function loadClasses() {
		loadingClasses = true;
		classesError = null;
		try {
			vehicleClasses = await getVehicleClasses();
			if (vehicleClasses.length && !vehicleClassId) vehicleClassId = vehicleClasses[0].id;
		} catch (e) {
			classesError = (e as Error).message;
		} finally {
			loadingClasses = false;
		}
	}

	$effect(() => {
		loadClasses();
	});

	async function submit(e: Event) {
		e.preventDefault();
		error = null;
		submitting = true;
		try {
			await phoneLogin(phone, 'driver');
			await submitDriverOnboarding({ fullName, phone, association, vehicleClassId });
			submitted = true;
		} catch (err) {
			error = (err as Error).message;
			if (err instanceof ApiError && err.code === 'NO_SESSION') {
				// phone-login failed before a session existed
			}
		} finally {
			submitting = false;
		}
	}
</script>

<div class="app-frame">
	<TopBar title="Driver onboarding" onBack={() => history.back()} />

	{#if submitted}
		<div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
			<div class="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-light-teal text-deep-teal">
				<Icon name="check" size={26} class="text-primary-teal" />
			</div>
			<h1 class="text-h1 text-text-primary">Application submitted</h1>
			<p class="mt-2 max-w-[300px] text-body-rg text-text-muted">
				Your profile is now pending admin verification. You'll be able to go online and accept rides as soon as it's approved.
			</p>
			<button type="button" class="btn-primary mt-6" onclick={() => goto('/driver')}>
				Go to dashboard
			</button>
		</div>
	{:else}
		<form class="flex flex-1 flex-col px-6 pt-6" onsubmit={submit}>
			<div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-light-teal text-deep-teal">
				<Icon name="person" size={20} />
			</div>

			<h1 class="text-h1 text-text-primary">Your driver profile</h1>
			<p class="mt-1 text-body-rg text-text-muted">These details will be shown to travelers you drive.</p>

			<div class="mt-6 flex flex-col gap-4">
				<div>
					<label class="field-label" for="fullName">Full name</label>
					<input id="fullName" class="field-input" type="text" bind:value={fullName} placeholder="e.g. Joseph Mwangi" required />
				</div>
				<div>
					<label class="field-label" for="phone">Phone</label>
					<input id="phone" class="field-input" type="tel" inputmode="tel" bind:value={phone} placeholder="+256 7xx xxx xxx or +254 7xx xxx xxx" required />
				</div>
				<div>
					<label class="field-label" for="association">Taxi association / SACCO</label>
					<input id="association" class="field-input" type="text" bind:value={association} placeholder="e.g. Kampala Tourist Taxis Assoc." required />
				</div>
				<div>
					<label class="field-label" for="vehicleClass">Vehicle class</label>
					{#if loadingClasses}
						<div class="h-12 animate-pulse rounded-xl bg-slate-100"></div>
					{:else if classesError}
						<div class="rounded-xl border border-red-200 bg-red-50 p-3 text-caption font-medium text-red-700">
							<p>{classesError}</p>
							<button type="button" class="mt-1 font-semibold underline underline-offset-2" onclick={loadClasses}>Try again</button>
						</div>
					{:else}
						<select id="vehicleClass" class="field-input" bind:value={vehicleClassId} required>
							{#each vehicleClasses as vc}
								<option value={vc.id}>{vc.name} — {vc.seats}</option>
							{/each}
						</select>
					{/if}
				</div>
			</div>

			{#if error}
				<div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-caption font-medium text-red-700">
					{error}
				</div>
			{/if}

			<div class="mt-auto pb-6 pt-8">
				<button type="submit" class="btn-primary" disabled={submitting || loadingClasses || !!classesError}>
					{submitting ? 'Submitting…' : 'Submit for review'}
				</button>
			</div>
		</form>
	{/if}
</div>
