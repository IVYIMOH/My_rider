<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { verifyEmail } from '$lib/auth';

	let token = $state('');
	let phase = $state<'verifying' | 'success' | 'error'>('verifying');
	let message = $state('');

	$effect(() => {
		const t = page.url.searchParams.get('token');
		if (!t) {
			phase = 'error';
			message = 'Missing verification token.';
			return;
		}
		token = t;
		verifyEmail(t)
			.then((res) => {
				phase = 'success';
				message = res.message;
			})
			.catch((e) => {
				phase = 'error';
				message = (e as Error).message;
			});
	});
</script>

<div class="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
	<div class="w-full max-w-md">
		<div class="card p-8 text-center">
			{#if phase === 'verifying'}
				<div class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-light-teal border-t-primary-teal"></div>
				<h1 class="text-body-lg font-semibold text-text-primary">Verifying your email…</h1>
			{:else if phase === 'success'}
				<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-light-teal text-deep-teal">
					<Icon name="check" size={24} class="text-primary-teal" />
				</div>
				<h1 class="text-body-lg font-semibold text-text-primary">Email verified</h1>
				<p class="mt-1 text-caption text-text-muted">{message}</p>
				<button type="button" class="btn-primary mt-6" onclick={() => goto('/login')}>Log in</button>
			{:else}
				<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
					<Icon name="shield" size={22} />
				</div>
				<h1 class="text-body-lg font-semibold text-text-primary">Verification failed</h1>
				<p class="mt-1 text-caption text-text-muted">{message}</p>
				<button type="button" class="btn-primary mt-6" onclick={() => goto('/login')}>Back to login</button>
			{/if}
		</div>
	</div>
</div>
