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
		// min-h is a floor that applies even if a parent gives height:auto/0 —
		// unlike h-full, it doesn't depend on any ancestor having a defined height
		class: className = 'h-full w-full min-h-[320px]'
	} = $props<{
		center?: LatLng;
		zoom?: number;
		markers?: MapMarker[];
		path?: LatLng[] | null;
		class?: string;
	}>();

	// Standard OpenStreetMap raster tiles. No API key required; attribution is
	// mandatory under the OSM tile usage policy.
	const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	const TILE_ATTRIBUTION =
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

	let mapEl: HTMLDivElement | undefined = $state();
	let map: LeafletMap | null = $state(null);
	let loadError = $state(false);
	let leaflet: typeof import('leaflet') | null = null;
	let markerLayer: LayerGroup | null = null;
	let pathLine: Polyline | null = null;
	let resizeObserver: ResizeObserver | null = null;

	onMount(async () => {
		try {
			// Dynamic import keeps window/document-dependent Leaflet out of SSR.
			const L = await import('leaflet');
			leaflet = L;

			map = L.map(mapEl!, {
				zoomControl: true,
				attributionControl: true
			}).setView([center.lat, center.lng], zoom);

			L.tileLayer(TILE_URL, {
				maxZoom: 19,
				attribution: TILE_ATTRIBUTION
			}).addTo(map);

			markerLayer = L.layerGroup().addTo(map);
			renderMarkers();
			renderPath();

			// Instead of guessing when layout settles, react whenever this
			// element's own box actually changes size — covers the initial
			// 0→nonzero transition, orientation change, keyboard open/close, etc.
			resizeObserver = new ResizeObserver(() => {
				map?.invalidateSize();
			});
			resizeObserver.observe(mapEl!);
		} catch (err) {
			console.error('OpenStreetMap failed to load', err);
			loadError = true;
		}
	});

	function renderMarkers() {
		if (!leaflet || !markerLayer) return;
		markerLayer.clearLayers();
		for (const m of markers) {
			const marker = leaflet.circleMarker([m.lat, m.lng], {
				radius: 8,
				color: '#ffffff',
				weight: 3,
				fillColor: m.color ?? '#149AA0',
				fillOpacity: 1
			});
			if (m.label) marker.bindTooltip(m.label);
			marker.addTo(markerLayer);
		}
	}

	function renderPath() {
		if (!map || !leaflet) return;
		if (pathLine) {
			pathLine.remove();
			pathLine = null;
		}
		if (path && path.length > 1) {
			pathLine = leaflet
				.polyline(
					path.map((p: LatLng) => [p.lat, p.lng] as [number, number]),
					{ color: '#0D6F75', opacity: 0.9, weight: 3 }
				)
				.addTo(map);
		}
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
		resizeObserver?.disconnect();
		resizeObserver = null;
		if (map) map.remove();
		map = null;
		markerLayer = null;
		pathLine = null;
	});
</script>

<div class={className}>
	{#if loadError}
		<!-- Graceful fallback so the UI still looks intentional if tiles fail -->
		<div
			class="flex h-full w-full items-center justify-center rounded-2xl bg-[#EAF3F3] bg-[radial-gradient(circle_at_1px_1px,#D5E6E7_1px,transparent_0)] bg-[length:18px_18px] text-center"
		>
			<div class="max-w-[220px] text-caption text-text-muted">
				Map preview unavailable — check your connection and reload.
			</div>
		</div>
	{:else}
		<div bind:this={mapEl} class="relative z-0 h-full w-full rounded-2xl"></div>
	{/if}
</div>
