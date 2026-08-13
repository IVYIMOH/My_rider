<script lang="ts">
	let { 
		center = { lat: 0.3476, lng: 32.5825 }, 
		zoom = 12, 
		markers = [] 
	} = $props<{
		center?: { lat: number; lng: number };
		zoom?: number;
		markers?: Array<{ lat: number; lng: number; label?: string }>;
	}>();
</script>

<div class="w-full h-full bg-[#EAEFF3] relative overflow-hidden flex flex-col justify-between rounded-2xl border border-border">
	<!-- Abstract Map Vector Infrastructure Overlay -->
	<div class="absolute inset-0 opacity-30 pointer-events-none">
		<div class="absolute w-[200%] h-[2px] bg-white top-1/4 left-0 rotate-6"></div>
		<div class="absolute w-[200%] h-[2px] bg-white top-1/2 left-0 -rotate-12"></div>
		<div class="absolute w-[200%] h-[2px] bg-white top-3/4 left-0 rotate-45"></div>
		<div class="absolute w-[2px] h-[200%] bg-white left-1/4 top-0 -rotate-12"></div>
		<div class="absolute w-[2px] h-[200%] bg-white left-2/3 top-0 rotate-12"></div>
		<div class="absolute w-32 h-32 rounded-full bg-primary-teal/10 top-1/3 left-1/3"></div>
	</div>

	<!-- Reactive Visual Marker Render Array Loop -->
	{#each markers as marker}
		<div class="absolute flex flex-col items-center z-10 transition-all duration-300" style="top: 45%; left: 50%; transform: translate(-50%, -50%);">
			<div class="w-8 h-8 rounded-full bg-primary-teal border-4 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold animate-bounce">
				📍
			</div>
			{#if marker.label}
				<div class="bg-text-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-md mt-1 whitespace-nowrap tracking-wide">
					{marker.label}
				</div>
			{/if}
		</div>
	{/each}

	<!-- Zoom Interface Controls Mock Overlay -->
	<div class="absolute bottom-3 right-3 flex flex-col gap-1 z-20">
		<button type="button" class="w-8 h-8 bg-white border border-border rounded-lg shadow-sm flex items-center justify-center font-bold text-text-primary hover:bg-slate-50 active:scale-95">+</button>
		<button type="button" class="w-8 h-8 bg-white border border-border rounded-lg shadow-sm flex items-center justify-center font-bold text-text-primary hover:bg-slate-50 active:scale-95">−</button>
	</div>
</div>
