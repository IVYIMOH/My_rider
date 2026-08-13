<script>
	import { onMount, onDestroy } from 'svelte';
	import { Loader } from '@googlemaps/js-api-loader';

	/**
	 * @typedef {{ lat: number, lng: number, label?: string, color?: string }} MapMarker
	 */

	let {
		center = { lat: 0.3476, lng: 32.5825 }, // Kampala, Uganda
		zoom = 12,
		markers = /** @type {MapMarker[]} */ ([]),
		path = /** @type {{lat:number,lng:number}[] | null} */ (null),
		class: className = 'h-full w-full',
		mapId = null
	} = $props();

	/** @type {HTMLDivElement} */
	let mapEl;
	let map = $state(null);
	let loadError = $state(false);
	/** @type {any[]} */
	let mapMarkers = [];
	/** @type {any} */
	let mapPolyline = null;

	const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

	// Muted, teal-tinted map theme so it matches the app's palette instead of
	// default Google Maps saturated colors.
	const mapStyles = [
		{ elementType: 'geometry', stylers: [{ color: '#F1F5F6' }] },
		{ elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
		{ elementType: 'labels.text.stroke', stylers: [{ color: '#F6FAFB' }] },
		{ featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE8EA' }] },
		{ featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
		{ featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FDF6E3' }] },
		{ featureType: 'poi', stylers: [{ visibility: 'off' }] },
		{ featureType: 'transit', stylers: [{ visibility: 'off' }] }
	];

	onMount(async () => {
		if (!apiKey) {
			loadError = true;
			return;
		}
		try {
			const loader = new Loader({ apiKey, version: 'weekly' });
			const { Map } = await loader.importLibrary('maps');
			await loader.importLibrary('marker');

			map = new Map(mapEl, {
				center,
				zoom,
				disableDefaultUI: true,
				zoomControl: true,
				styles: mapStyles,
				mapId: mapId ?? undefined
			});

			renderMarkers();
			renderPath();
		} catch (err) {
			console.error('Google Maps failed to load', err);
			loadError = true;
		}
	});

	function renderMarkers() {
		if (!map) return;
		mapMarkers.forEach((m) => (m.map = null));
		mapMarkers = markers.map((m) => {
			const pin = document.createElement('div');
			pin.style.width = '16px';
			pin.style.height = '16px';
			pin.style.borderRadius = '50%';
			pin.style.border = '3px solid white';
			pin.style.boxShadow = '0 1px 4px rgba(15,23,42,0.35)';
			pin.style.background = m.color ?? '#149AA0';

			return new google.maps.marker.AdvancedMarkerElement({
				map,
				position: { lat: m.lat, lng: m.lng },
				title: m.label ?? '',
				content: pin
			});
		});
	}

	function renderPath() {
		if (!map) return;
		if (mapPolyline) mapPolyline.setMap(null);
		if (path && path.length > 1) {
			mapPolyline = new google.maps.Polyline({
				path,
				strokeColor: '#0D6F75',
				strokeOpacity: 0.9,
				strokeWeight: 3,
				map
			});
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
		mapMarkers.forEach((m) => (m.map = null));
		if (mapPolyline) mapPolyline.setMap(null);
	});
</script>

<div class={className}>
	{#if loadError}
		<!-- Graceful fallback so the UI still looks intentional without an API key -->
		<div
			class="flex h-full w-full items-center justify-center rounded-2xl bg-[#EAF3F3] bg-[radial-gradient(circle_at_1px_1px,#D5E6E7_1px,transparent_0)] bg-[length:18px_18px] text-center"
		>
			<div class="max-w-[220px] text-caption text-text-muted">
				Map preview unavailable — add <code class="rounded bg-white px-1 py-0.5 text-[11px]"
					>VITE_GOOGLE_MAPS_API_KEY</code
				> to your .env to enable live maps.
			</div>
		</div>
	{:else}
		<div bind:this={mapEl} class="h-full w-full rounded-2xl"></div>
	{/if}
</div>