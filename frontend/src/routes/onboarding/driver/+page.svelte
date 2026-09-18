<script lang="ts">
	import { goto } from '$app/navigation';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PhoneLoginForm from '$lib/components/PhoneLoginForm.svelte';
	import { getVehicleClasses, submitDriverOnboarding } from '$lib/api';
	import { session } from '$lib/auth';
	import type { VehicleClass } from '$lib/api';

	let fullName = $state('');
	let association = $state('');
	let vehicleClassId = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	let vehicleClasses = $state<VehicleClass[]>([]);
	let loadingClasses = $state(true);
	let classesError = $state<string | null>(null);

	let submitted = $state(false);

	// The number is confirmed by OTP during sign-in, so onboarding shows it
	// read-only and reuses the normalized E.164 value the backend stored rather
	// than re-asking (and risking a differently-formatted duplicate).
	const verifiedPhone = $derived($session?.user.phone ?? '');
	const authed = $derived(!!$session?.token);

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
			await submitDriverOnboarding({
				fullName,
				association,
				vehicleClassId
			});
			submitted = true;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			submitting = false;
		}
	}
</script>

<div class="app-frame">
	<TopBar title="Driver onboarding" onBack={() => history.back()} />

	{#if !authed}
		<div class="flex flex-1 items-center justify-center p-6">
			<div class="w-full max-w-sm">
				<PhoneLoginForm
					role="driver"
					title="Verify your phone to apply"
					buttonLabel="Verify & continue"
				/>
			</div>
		</div>
	{:else if submitted}
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
					<div class="flex items-center gap-2 rounded-xl border border-border bg-slate-50 px-3.5 py-3">
						<Icon name="check" size={14} class="text-primary-teal" />
						<span class="text-body-rg font-medium text-text-primary">{verifiedPhone}</span>
						<span class="ml-auto text-caption text-text-muted">Verified</span>
					</div>
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
