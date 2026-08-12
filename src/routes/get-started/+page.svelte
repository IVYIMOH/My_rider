<script lang="ts">
	import { goto } from '$app/navigation';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import GoogleMap from '$lib/components/GoogleMap.svelte';
	import Icon from '$lib/components/Icon.svelte';

	// Svelte 5 states to manage user flow step-by-step
	let flowStep = $state('empty'); // 'empty' | 'select_vehicle'
	let selectedVehicle = $state('car');
	let activeTab = $state('home');

	const vehicleClasses = [
		{ id: 'car', name: 'Car / SUV', rate: '×1', seats: 'Up to 4 seats', price: 'USD 46.34' },
		{ id: 'van', name: 'Van / Minibus', rate: '×1.25', seats: '9-14 seats', price: 'USD 58.17' },
		{ id: 'coach', name: 'Coach bus', rate: '×1.6', seats: '15+ seats', price: 'USD 74.54' },
		{ id: 'truck', name: 'Truck / 4×4 cargo', rate: '×1.8', seats: 'Heavy load', price: 'USD 83.61' }
	];

	const locations = [
		{ type: 'pickup', name: 'Sheraton Kampala Hotel', dot: '🟢' },
		{ type: 'destination', name: 'Entebbe Airport Arrivals', dot: '🟠' }
	];
</script>

<div class="app-frame relative flex flex-col h-full bg-white overflow-hidden">
	<StatusBar />

	<!-- Absolute Floating Map Container Interface Component -->
	<div class="w-full flex-1 relative min-h-0">
		<GoogleMap 
			markers={[
				{ lat: 0.3476, lng: 32.5825, label: 'Sheraton Kampala' }
			]}
		/>

		<!-- Floating Top Header Card Overlay -->
		<div class="absolute top-4 inset-x-4 z-20 bg-white/90 backdrop-blur border border-border p-3 rounded-xl shadow-md flex items-center gap-3">
			<button type="button" class="text-text-muted hover:text-text-primary p-1 text-sm font-bold" onclick={() => goto('/')}>
				←
			</button>
			<div class="flex-1">
				<h2 class="text-caption font-bold uppercase tracking-wider text-text-muted">Current Target</h2>
				<p class="text-xs font-semibold text-text-primary truncate">Kampala District Exploration</p>
			</div>
			<Icon name="compass" size={18} class="text-primary-teal animate-spin" />
		</div>

		<!-- CONDITIONAL SCREEN WORKSPACE LAYERS -->
		{#if flowStep === 'empty'}
			<!-- CASE A: Empty Trip State Modal Box Overlay -->
			<div class="absolute bottom-4 inset-x-4 z-20 bg-white/95 backdrop-blur p-5 rounded-2xl shadow-xl border border-border text-center flex flex-col items-center">
				<div class="w-12 h-12 bg-light-teal text-deep-teal rounded-full flex items-center justify-center text-xl mb-2">
					<Icon name="clock" size={24} class="text-primary-teal" />
				</div>
				<h3 class="text-body-lg font-semibold text-text-primary">No active ride request</h3>
				<p class="text-caption text-text-muted mt-1 max-w-[200px]">Book a trusted taxi association driver right now.</p>
				<button 
					type="button" 
					class="btn-primary mt-4 py-2.5 text-xs tracking-wide uppercase font-bold"
					onclick={() => flowStep = 'select_vehicle'}
				>
					Request a Driver
				</button>
			</div>

		{:else if flowStep === 'select_vehicle'}
			<!-- CASE B: Request Configurator Screen Tray Panel -->
			<div class="absolute inset-x-0 bottom-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border-t border-border p-5 flex flex-col max-h-[80%] overflow-y-auto no-scrollbar">
				<div class="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>
				
				<!-- Heading Row -->
				<div class="flex items-center justify-between mb-3 shrink-0">
					<h3 class="text-caption font-bold uppercase tracking-wider text-text-muted">Select Vehicle</h3>
					<button type="button" class="text-caption text-primary-teal font-semibold hover:underline" onclick={() => flowStep = 'empty'}>Cancel</button>
				</div>

				<!-- Grid Selection Array Layout Matrix -->
				<div class="grid grid-cols-2 gap-2.5 mb-4 shrink-0">
					{#each vehicleClasses as item}
						<button 
							type="button"
							onclick={() => selectedVehicle = item.id}
							class="p-3 border text-left rounded-xl transition-all duration-200 flex flex-col justify-between h-24
							{selectedVehicle === item.id ? 'border-primary-teal bg-light-teal ring-1 ring-primary-teal/20' : 'border-border bg-white hover:bg-slate-50'}"
						>
							<div class="flex justify-between items-start w-full">
								<span class="font-bold text-xs text-text-primary">{item.name}</span>
								<span class="text-[10px] font-semibold opacity-70 {selectedVehicle === item.id ? 'text-deep-teal' : 'text-text-muted'}">{item.rate}</span>
							</div>
							<div>
								<div class="text-[10px] text-text-muted font-medium">{item.seats}</div>
								<div class="text-xs font-bold text-text-primary mt-0.5">{item.price}</div>
							</div>
						</button>
					{/each}
				</div>

				<!-- Route Parameter Node Selection Block -->
				<h3 class="text-caption font-bold uppercase tracking-wider text-text-muted mb-2 shrink-0">Selected Nodes</h3>
				<div class="border border-border rounded-xl divide-y divide-border text-xs text-text-primary mb-4 bg-slate-50 overflow-hidden shrink-0">
					{#each locations as loc}
						<div class="p-3 flex items-center justify-between">
							<div class="flex items-center gap-2 truncate">
								<span>{loc.dot}</span>
								<span class="font-medium truncate">{loc.name}</span>
							</div>
							<Icon name="chevron" size={12} class="text-text-muted" />
						</div>
					{/each}
				</div>

				<!-- Fare Computation Calculation Summary Line Module -->
				<div class="flex items-center justify-between border-t border-slate-100 pt-3 mb-4 shrink-0">
					<div>
						<p class="text-caption font-semibold text-text-muted">Estimated Base Fare</p>
						<p class="text-[10px] text-text-muted/70">Calculated via active Admin config tokens</p>
					</div>
					<p class="text-lg font-bold text-text-primary">
						{vehicleClasses.find(v => v.id === selectedVehicle)?.price}
					</p>
				</div>

				<!-- Primary Trigger Button Call Action -->
				<button 
					type="button" 
					class="btn-primary w-full py-3.5 shrink-0"
					onclick={() => {
						alert('Ride requested! Connecting with trusted local drivers...');
						flowStep = 'empty';
					}}
				>
					Confirm Request
				</button>
			</div>
		{/if}
	</div>

	<BottomNav bind:activeTab />
</div>
