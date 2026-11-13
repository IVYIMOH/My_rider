<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type { Map as LeafletMap, LayerGroup, Polyline } from 'leaflet';

	interface LatLng {
		lat: number;
		lng: number;
	}

	interface MapMarker extends LatLng {
		label?: string;
		color?: string;
	}

	let {
		center = { lat: 0.3476, lng: 32.5825 }, // Kampala, Uganda
		zoom = 12,
		markers = [] as MapMarker[],
		path = null as LatLng[] | null,
		class: className = 'h-full w-full'
	} = $props<{
		center?: LatLng;
		zoom?: number;
		markers?: MapMarker[];
		path?: LatLng[] | null;
		class?: string;
	}>();

	let mapEl: HTMLDivElement | undefined = $state();
	let map: LeafletMap | null = $state(null);
	let loadError = $state(false);
	let markerLayer: LayerGroup | null = null;
	let polyline: Polyline | null = null;

	onMount(async () => {
		try {
			const L = (await import('leaflet')).default;

			map = L.map(mapEl!, { zoomControl: true }).setView([center.lat, center.lng], zoom);
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 19
			}).addTo(map);

			markerLayer = L.layerGroup().addTo(map);
			renderMarkers();
			renderPath();
			requestAnimationFrame(() => map?.invalidateSize());
		} catch (err) {
			console.error('OpenStreetMap failed to load', err);
			loadError = true;
		}
	});

	function renderMarkers() {
		if (!map || !markerLayer) return;
		import('leaflet').then(({ default: L }) => {
			if (!map || !markerLayer) return;
			markerLayer.clearLayers();
			for (const m of markers) {
				L.circleMarker([m.lat, m.lng], {
					radius: 8,
					color: '#ffffff',
					weight: 3,
					fillColor: m.color ?? '#149AA0',
					fillOpacity: 1
				})
					.bindTooltip(m.label ?? '', { direction: 'top' })
					.addTo(markerLayer!);
			}

			if (markers.length >= 2) {
				map.fitBounds(
					markers.map((m: MapMarker) => [m.lat, m.lng]),
					{ padding: [32, 32], maxZoom: 14 }
				);
			} else if (markers.length === 1) {
				map.setView([markers[0].lat, markers[0].lng], map.getZoom());
			}
		});
	}

	function renderPath() {
		if (!map) return;
		import('leaflet').then(({ default: L }) => {
			if (!map) return;
			if (polyline) {
				polyline.remove();
				polyline = null;
			}
			if (path && path.length > 1) {
				polyline = L.polyline(
					path.map((p: LatLng) => [p.lat, p.lng]),
					{ color: '#0D6F75', weight: 3, opacity: 0.9 }
				).addTo(map);
			}
		});
	}

	$effect(() => {
		markers;
		if (map) renderMarkers();
	});

	$effect(() => {
		path;
		if (map) renderPath();
	});

	onDestroy(() => {
		map?.remove();
		map = null;
	});
</script>

<div class={className}>
	{#if loadError}
		<div
			class="flex h-full w-full items-center justify-center rounded-2xl bg-[#EAF3F3] bg-[radial-gradient(circle_at_1px_1px,#D5E6E7_1px,transparent_0)] bg-[length:18px_18px] text-center"
		>
			<div class="max-w-[220px] text-caption text-text-muted">
				Map preview is unavailable right now. Check your connection and try again.
			</div>
		</div>
	{:else}
		<div bind:this={mapEl} class="h-full w-full rounded-2xl"></div>
	{/if}
</div>
