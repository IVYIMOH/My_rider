<script>
	let { dark = false } = $props();
</script>

<div
	class="flex items-center justify-between px-6 pb-1 pt-3 text-[13px] font-semibold {dark
		? 'text-white'
		: 'text-text-primary'}"
>
	<span>9:41</span>
	<div class="flex items-center gap-1.5">
		<!-- signal -->
		<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
			<rect x="0" y="7" width="3" height="5" rx="0.5" />
			<rect x="5" y="5" width="3" height="7" rx="0.5" />
			<rect x="10" y="3" width="3" height="9" rx="0.5" />
			<rect x="15" y="0" width="3" height="12" rx="0.5" />
		</svg>
		<!-- wifi -->
		<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.5">
			<path d="M1 4.5a10 10 0 0 1 14 0M3.5 7a6.5 6.5 0 0 1 9 0M6.2 9.4a2.8 2.8 0 0 1 3.6 0" stroke-linecap="round" />
		</svg>
		<!-- battery -->
		<svg width="24" height="12" viewBox="0 0 24 12" fill="none">
			<rect x="0.5" y="0.5" width="20" height="11" rx="2.5" stroke="currentColor" opacity="0.4" />
			<rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor" />
			<rect x="21.5" y="4" width="1.8" height="4" rx="0.9" fill="currentColor" opacity="0.4" />
		</svg>
	</div>
</div>