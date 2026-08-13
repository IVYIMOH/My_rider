<script lang="ts">
	import { redirect } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { login, register, isAuthenticated } from '$lib/auth';

	if (isAuthenticated()) redirect(307, '/overview');

	const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let mode = $state<'login' | 'register'>('login');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirm = $state('');
	let showPassword = $state(false);
	let error = $state<string | null>(null);
	let loading = $state(false);

	function validate(): string | null {
		if (!emailRe.test(email.trim())) return 'Enter a valid email address.';
		if (password.length < 8) return 'Password must be at least 8 characters.';
		if (mode === 'register') {
			if (!name.trim()) return 'Full name is required.';
			if (password !== confirm) return 'Passwords do not match.';
		}
		return null;
	}

	async function submit() {
		error = null;
		const invalid = validate();
		if (invalid) {
			error = invalid;
			return;
		}
		loading = true;
		try {
			if (mode === 'login') await login(email.trim(), password);
			else await register(name, email.trim(), password);
			goto('/overview');
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	function switchMode(next: 'login' | 'register') {
		mode = next;
		error = null;
	}
</script>

<div class="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
	<div class="w-full max-w-md">
		<div class="mb-8 flex flex-col items-center gap-3 text-center">
			<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-deep-teal text-2xl font-bold text-white">
				S
			</div>
			<div>
				<h1 class="text-h1 font-semibold text-text-primary">SipiRider Admin</h1>
				<p class="mt-1 text-body-rg text-text-muted">Sign in to manage pricing, drivers, and users.</p>
			</div>
		</div>

		<div class="card p-6">
			<div class="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
				<button
					type="button"
					class="flex-1 rounded-lg py-2 text-body-rg font-medium transition {mode === 'login'
						? 'bg-white text-text-primary shadow-sm'
						: 'text-text-muted hover:text-text-primary'}"
					onclick={() => switchMode('login')}
				>
					Log in
				</button>
				<button
					type="button"
					class="flex-1 rounded-lg py-2 text-body-rg font-medium transition {mode === 'register'
						? 'bg-white text-text-primary shadow-sm'
						: 'text-text-muted hover:text-text-primary'}"
					onclick={() => switchMode('register')}
				>
					Create account
				</button>
			</div>

			<form class="flex flex-col gap-4" onsubmit={(e) => { e.preventDefault(); submit(); }}>
				{#if mode === 'register'}
					<div>
						<label class="field-label" for="name">Full name</label>
						<input id="name" class="field-input" type="text" bind:value={name} autocomplete="name" />
					</div>
				{/if}

				<div>
					<label class="field-label" for="email">Email</label>
					<input
						id="email"
						class="field-input"
						type="email"
						bind:value={email}
						autocomplete="email"
						placeholder="you@example.com"
					/>
				</div>

				<div>
					<label class="field-label" for="password">Password</label>
					<div class="relative">
						<input
							id="password"
							class="field-input pr-11"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
							placeholder={mode === 'login' ? '••••••••' : 'At least 8 characters'}
						/>
						<button
							type="button"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition hover:text-text-primary"
							onclick={() => (showPassword = !showPassword)}
						>
							<Icon name={showPassword ? 'profile' : 'shield'} size={18} />
						</button>
					</div>
				</div>

				{#if mode === 'register'}
					<div>
						<label class="field-label" for="confirm">Confirm password</label>
						<input
							id="confirm"
							class="field-input"
							type={showPassword ? 'text' : 'password'}
							bind:value={confirm}
							autocomplete="new-password"
							placeholder="Re-enter password"
						/>
					</div>
				{/if}

				{#if error}
					<div class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-caption font-medium text-red-700">
						{error}
					</div>
				{/if}

				<button type="submit" class="btn-primary mt-1" disabled={loading}>
					{#if loading}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
						Please wait…
					{:else if mode === 'login'}
						Log in
					{:else}
						Create account
					{/if}
				</button>
			</form>
		</div>

		{#if mode === 'login'}
			<p class="mt-5 text-center text-caption text-text-muted">
				Demo credentials — email
				<span class="font-semibold text-deep-teal">admin@sipirider.com</span>
				· password
				<span class="font-semibold text-deep-teal">admin1234</span>
			</p>
		{/if}
	</div>
</div>
