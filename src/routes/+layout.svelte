<script>
	import '../app.css';
	let { children } = $props();
</script>

<div class="min-h-dvh bg-slate-100 sm:py-6">
	{@render children()}
</div>