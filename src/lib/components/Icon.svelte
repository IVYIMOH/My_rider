<script lang="ts">
	/**
	 * Minimal outline icon set matching the spec sheet's icon style:
	 * rounded stroke line icons, 1.75px stroke, no fill.
	 */
	let { name = 'home', size = 22, class: className = '' } = $props<{
		name?: string;
		size?: number;
		class?: string;
	}>();

	const paths: Record<string, string> = {
		home: 'M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3.5v-5.5h3V20H17a1 1 0 0 0 1-1v-9',
		bookings: 'M7 3.5v3M17 3.5v3M4.5 9h15M6 6h12a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V7.5A1.5 1.5 0 0 1 6 6Z',
		scan: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16',
		messages: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 14.5v-9Z',
		profile: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
		car: 'M5 16.5V12l1.6-4.4A2 2 0 0 1 8.5 6.2h7a2 2 0 0 1 1.9 1.4L19 12v4.5M5 16.5a1 1 0 0 0 1 1h.5a1 1 0 0 0 1-1V15h9v1.5a1 1 0 0 0 1 1H18a1 1 0 0 0 1-1M5 16.5V15M19 16.5V15M7.5 11.5h9M7.75 14a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm8.5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z',
		pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
		calendar: 'M7 3.5v3M17 3.5v3M4.5 9h15M6 6h12a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V7.5A1.5 1.5 0 0 1 6 6Z',
		chat: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 14.5v-9Z',
		person: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
		star: 'm12 4 2.47 5.16 5.53.65-4.1 3.86 1.1 5.58L12 16.5l-5 2.75 1.1-5.58-4.1-3.86 5.53-.65Z',
		clock: 'M12 7v5.5l3.5 2M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
		shield: 'M12 3.5 5 6v5.5c0 4.7 3 7.6 7 9 4-1.4 7-4.3 7-9V6l-7-2.5Zm-2.5 8.5 1.8 1.8L15 10',
		compass: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Zm3-11.5-2 5-5 2 2-5 5-2Z',
		menu: 'M4.5 6.5h15M4.5 12h15M4.5 17.5h15',
		back: 'm14.5 4.5-7 7.5 7 7.5',
		chevron: 'm9 5 7 7-7 7',
		check: 'm5 12 4.5 4.5L19 7',
		globe: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Zm-8.5-8.5h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z',
		plus: 'M12 5v14M5 12h14',
		minus: 'M5 12h14',
		wallet: 'M4 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm12 4.5h2M4 8l2.5-3.5h9L18 8',
		users: 'M8.5 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8a6 6 0 0 1 12 0M16 6.2a3.5 3.5 0 0 1 0 6.6M19.5 20.5a6 6 0 0 0-4-5.6'
	};
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
>
	<path d={paths[name] ?? paths.home} />
</svg>
