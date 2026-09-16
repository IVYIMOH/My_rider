<script lang="ts">
	import { redirect } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { login, resendVerification, isAuthenticated } from '$lib/auth';
	import { ApiError } from '$lib/http';

	if (isAuthenticated()) redirect(307, '/overview');

	const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let error = $state<string | null>(null);
	let unverified = $state(false);
	let loading = $state(false);
	let resending = $state(false);
	let resent = $state(false);

	function validate(): string | null {
		if (!emailRe.test(email.trim())) return 'Enter a valid email address.';
		if (password.length < 8) return 'Password must be at least 8 characters.';
		return null;
	}

	async function submit() {
		error = null;
		unverified = false;
		const invalid = validate();
		if (invalid) {
			error = invalid;
			return;
		}
		loading = true;
		try {
			await login(email.trim(), password);
			goto('/overview');
		} catch (e) {
			if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
				unverified = true;
				error = e.message;
			} else {
				error = (e as Error).message;
			}
		} finally {
			loading = false;
		}
	}

	async function resend() {
		resending = true;
		resent = false;
		try {
			await resendVerification(email.trim());
			resent = true;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			resending = false;
		}
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
			<form class="flex flex-col gap-4" onsubmit={(e) => { e.preventDefault(); submit(); }}>
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
							autocomplete="current-password"
							placeholder="••••••••"
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

				{#if error}
					<div
						class="rounded-xl border px-3.5 py-2.5 text-caption font-medium {unverified
							? 'border-amber-200 bg-amber-50 text-amber-700'
							: 'border-red-200 bg-red-50 text-red-700'}"
					>
						<p>{error}</p>
						{#if unverified}
							<button
								type="button"
								class="mt-2 text-caption font-semibold underline underline-offset-2"
								onclick={resend}
								disabled={resending}
							>
								{resending ? 'Sending…' : 'Resend verification email'}
							</button>
							{#if resent}
								<p class="mt-1 text-success">A new verification link has been sent.</p>
							{/if}
						{/if}
					</div>
				{/if}

				<button type="submit" class="btn-primary mt-1" disabled={loading}>
					{#if loading}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
						Please wait…
					{:else}
						Log in
					{/if}
				</button>
			</form>

			<p class="mt-5 border-t border-border pt-4 text-center text-caption text-text-muted">
				Admin accounts are created by an existing admin, not self-service.
				<br />
				Need access? Ask an admin to add you from the Users page.
			</p>
		</div>
	</div>
</div>
