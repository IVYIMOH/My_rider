<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import MapWrapper from '$lib/components/MapWrapper.svelte';

	let activeTab = $state('map');

	// County-level default: Kapchorwa District (home of Sipi Falls), Eastern Uganda.
	const district = {
		name: 'Kapchorwa District',
		center: { lat: 1.3996, lng: 34.4495 },
		zoom: 11
	};
</script>

<div class="app-frame flex flex-col h-full bg-white">
	<TopBar title="Explore" onBack={() => history.back()} />

	<div class="relative flex-1 min-h-0">
		<MapWrapper
			class="absolute inset-0"
			center={district.center}
			zoom={district.zoom}
			markers={[{ lat: district.center.lat, lng: district.center.lng, label: 'Kapchorwa' }]}
		/>

		<div class="absolute top-4 inset-x-4 z-10 bg-white/90 backdrop-blur border border-border p-3 rounded-xl shadow-md">
			<p class="text-caption font-bold uppercase tracking-wider text-text-muted">District</p>
			<p class="text-xs font-semibold text-text-primary">{district.name}</p>
		</div>
	</div>

	<BottomNav bind:activeTab />
</div>
