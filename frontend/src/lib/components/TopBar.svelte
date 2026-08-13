<script>
	import Icon from './Icon.svelte';

	let { title = '', onBack = null, right = null } = $props();
</script>

<div class="flex items-center gap-3 px-4 pb-3 pt-1">
	{#if onBack}
		<button
			onclick={onBack}
			aria-label="Go back"
			class="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition hover:bg-slate-100 active:scale-95"
		>
			<Icon name="back" size={20} />
		</button>
	{/if}
	<h1 class="text-h2 text-text-primary">{title}</h1>
	{#if right}
		<div class="ml-auto">{@render right()}</div>
	{/if}
</div>