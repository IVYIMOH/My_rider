<script lang="ts">
	import Icon from './Icon.svelte';
	import { phoneLogin } from '$lib/auth';

	let {
		role = 'tourist',
		title = 'Continue with your phone',
		buttonLabel = 'Continue',
		onSuccess = null
	} = $props<{
		role?: 'tourist' | 'driver';
		title?: string;
		buttonLabel?: string;
		onSuccess?: (() => void) | null;
	}>();

	let phone = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function submit() {
		error = null;
		if (!phone.trim()) {
			error = 'Enter your phone number.';
			return;
		}
		loading = true;
		try {
			await phoneLogin(phone, role);
			onSuccess?.();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="card flex flex-col items-center py-10 text-center">
	<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-light-teal text-deep-teal">
		<Icon name="shield" size={22} class="text-primary-teal" />
	</div>
	<h2 class="text-body-lg font-semibold text-text-primary">{title}</h2>
	<p class="mt-1 max-w-[280px] text-caption text-text-muted">
		We'll verify your number is registered with MTN Uganda or Safaricom before continuing.
	</p>

	<form class="mt-5 flex w-full flex-col gap-3" onsubmit={(e) => { e.preventDefault(); submit(); }}>
		<input
			class="field-input text-center"
			type="tel"
			inputmode="tel"
			autocomplete="tel"
			placeholder="+256 7xx xxx xxx or +254 7xx xxx xxx"
			bind:value={phone}
		/>
		{#if error}
			<p class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-caption font-medium text-red-700">
				{error}
			</p>
		{/if}
		<button type="submit" class="btn-primary" disabled={loading}>
			{#if loading}
				<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
				Checking…
			{:else}
				{buttonLabel}
			{/if}
		</button>
	</form>
</div>
