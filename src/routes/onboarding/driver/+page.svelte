<script>
	import { goto } from '$app/navigation';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let fullName = $state('Joseph Mwangi');
	let phone = $state('+256 700 000 000');

	const step = 1;
	const totalSteps = 4;

	function submit(e) {
		e.preventDefault();
		goto('/driver');
	}
</script>

<div class="app-frame">
	<StatusBar />
	<TopBar title="Driver onboarding" onBack={() => history.back()} />

	<div class="px-6">
		<div class="h-1.5 w-full overflow-hidden rounded-pill bg-border">
			<div
				class="h-full rounded-pill bg-primary-teal transition-all"
				style="width: {(step / totalSteps) * 100}%"
			></div>
		</div>
	</div>

	<form class="flex flex-1 flex-col px-6 pt-6" onsubmit={submit}>
		<div class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-light-teal text-deep-teal">
			<Icon name="person" size={20} />
		</div>

		<h1 class="text-h1 text-text-primary">Personal details</h1>
		<p class="mt-1 text-body-rg text-text-muted">We'll show these to travelers you drive.</p>

		<div class="mt-6 flex flex-col gap-4">
			<div>
				<label class="field-label" for="fullName">Full name</label>
				<input id="fullName" class="field-input" type="text" bind:value={fullName} required />
			</div>
			<div>
				<label class="field-label" for="phone">Phone</label>
				<input id="phone" class="field-input" type="tel" bind:value={phone} required />
			</div>
		</div>

		<div class="mt-auto pb-6 pt-8">
			<button type="submit" class="btn-primary">Continue</button>
		</div>
	</form>
</div>