<script lang="ts">
	import PhoneLoginForm from './PhoneLoginForm.svelte';
	import { session } from '$lib/auth';

	let {
		role = 'tourist',
		title = 'Continue with your phone',
		onSuccess = null,
		children
	} = $props<{
		role?: 'tourist' | 'driver';
		title?: string;
		onSuccess?: (() => void) | null;
		children: import('svelte').Snippet;
	}>();

	const authed = $derived(!!$session?.token);
</script>

{#if authed}
	{@render children()}
{:else}
	<div class="flex h-full items-center justify-center p-6">
		<div class="w-full max-w-sm">
			<PhoneLoginForm {role} {title} {onSuccess} />
		</div>
	</div>
{/if}
