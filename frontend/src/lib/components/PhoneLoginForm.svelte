<script lang="ts">
	import Icon from './Icon.svelte';
	import { startPhoneLogin, verifyPhoneLogin } from '$lib/auth';

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

	let step = $state<'phone' | 'code'>('phone');
	let phone = $state('');
	let code = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	// The normalized number the code actually went to, echoed back by the API.
	let sentTo = $state('');
	// Populated only when the backend is in PHONE_MOCK mode, so local testing
	// does not require a real SMS gateway.
	let devCode = $state<string | null>(null);

	async function requestCode() {
		error = null;
		if (!phone.trim()) {
			error = 'Enter your phone number.';
			return;
		}
		loading = true;
		try {
			const challenge = await startPhoneLogin(phone, role);
			sentTo = challenge.phone;
			devCode = challenge.devCode ?? null;
			code = '';
			step = 'code';
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	async function submitCode() {
		error = null;
		if (code.trim().length !== 6) {
			error = 'Enter the 6-digit code.';
			return;
		}
		loading = true;
		try {
			await verifyPhoneLogin(sentTo, code.trim());
			onSuccess?.();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	function editNumber() {
		step = 'phone';
		error = null;
		code = '';
		devCode = null;
	}
</script>

<div class="card flex flex-col items-center py-10 text-center">
	<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-light-teal text-deep-teal">
		<Icon name="shield" size={22} class="text-primary-teal" />
	</div>

	{#if step === 'phone'}
		<h2 class="text-body-lg font-semibold text-text-primary">{title}</h2>
		<p class="mt-1 max-w-[280px] text-caption text-text-muted">
			We'll text you a 6-digit code to confirm the number is yours.
		</p>

		<form class="mt-5 flex w-full flex-col gap-3" onsubmit={(e) => { e.preventDefault(); requestCode(); }}>
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
					Sending code…
				{:else}
					Send code
				{/if}
			</button>
		</form>
	{:else}
		<h2 class="text-body-lg font-semibold text-text-primary">Enter your code</h2>
		<p class="mt-1 max-w-[280px] text-caption text-text-muted">
			We sent a 6-digit code to <span class="font-semibold text-text-primary">{sentTo}</span>.
		</p>

		{#if devCode}
			<p class="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700">
				Dev mode — your code is <span class="font-bold">{devCode}</span>
			</p>
		{/if}

		<form class="mt-5 flex w-full flex-col gap-3" onsubmit={(e) => { e.preventDefault(); submitCode(); }}>
			<input
				class="field-input text-center text-lg font-semibold tracking-[0.4em]"
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength="6"
				placeholder="000000"
				bind:value={code}
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
			<div class="flex items-center justify-center gap-4 text-caption">
				<button type="button" class="font-semibold text-primary-teal hover:underline" onclick={editNumber}>
					Change number
				</button>
				<button
					type="button"
					class="font-semibold text-primary-teal hover:underline disabled:opacity-50"
					onclick={requestCode}
					disabled={loading}
				>
					Resend code
				</button>
			</div>
		</form>
	{/if}
</div>
