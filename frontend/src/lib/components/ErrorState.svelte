<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		message = 'Something went wrong. Check the backend and try again.',
		code = '',
		retry = null
	} = $props<{ message?: string; code?: string; retry?: (() => void) | null }>();
</script>

<div class="card flex flex-col items-center justify-center py-10 text-center">
	<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
		<Icon name="shield" size={22} />
	</div>
	<h2 class="text-body-lg font-semibold text-text-primary">Could not load data</h2>
	<p class="mt-1 max-w-[320px] text-caption text-text-muted">{message}</p>
	{#if code}
		<p class="mt-1 rounded-lg bg-slate-100 px-2 py-1 font-mono text-[10px] text-text-muted">code: {code}</p>
	{/if}
	{#if retry}
		<button type="button" class="btn-primary mt-4 py-2.5 text-caption" onclick={retry}>Try again</button>
	{/if}
</div>
