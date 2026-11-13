<!-- Decorative landscape, using the same brand tokens as the rest of the app. -->
<svg viewBox="0 0 400 170" fill="none" aria-hidden="true" class="ride-scene">
	<circle cx="332" cy="35" r="27" class="sun" />
	<circle cx="332" cy="35" r="38" class="sun-ring" />
	<path d="M0 104 64 55 116 97 173 63 238 110 298 66 400 109V170H0Z" class="far-hills" />
	<path d="m0 113 59-37 56 30 63-24 73 35 55-28 94 30v51H0Z" class="near-hills" />
	<path d="M0 136c74-42 125 14 201-3s132-36 199-11v48H0Z" class="foreground" />
	<path d="M149 104c-21 19-3 34 68 35s128 3 157 31" class="road-edge" />
	<path d="M149 104c-21 19-3 34 68 35s128 3 157 31" class="road" />
	<path d="M149 104c-21 19-3 34 68 35s128 3 157 31" class="road-line" />
	<g class="tree">
		<path d="M40 104V73m0 10L29 75m11 4 12-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
		<path d="M17 70c0-8 10-15 21-13 5-12 29-7 29 4 14 3 13 16-1 18H28c-10 0-15-3-11-9Z" fill="currentColor" />
	</g>
	<g class="tree small-tree">
		<path d="M364 103V81m0 8 9-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
		<path d="M348 80c-4-9 7-17 16-14 8-9 22 0 20 7 9 6 3 14-7 13h-19c-7 0-11-2-10-6Z" fill="currentColor" />
	</g>
	<g transform="translate(164 56)">
		<ellipse cx="91" cy="82" rx="83" ry="9" class="car-shadow" />
		<path d="m36 34 17-24a12 12 0 0 1 10-5h53c8 0 12 3 18 10l17 21 19 6c6 2 9 7 9 13v16H10V52c0-8 4-12 12-14Z" class="car-body" />
		<path d="M36 34h115l-17-21c-4-5-9-8-16-8H63c-6 0-9 2-12 6Z" class="car-roof" />
		<path d="m48 31 12-17h25v17Zm45-17h24c4 0 6 1 9 5l10 12H93Z" class="car-window" />
		<path d="M92 14v48M38 37v26h105V39" class="car-detail" />
		<path d="M102 42h10M57 42h10" stroke="var(--color-light-teal)" stroke-width="2.5" stroke-linecap="round" />
		<path d="M11 51h13v8H10Zm153-2 14 3v8h-14Z" class="car-light" />
		<path d="M9 64h171v8H9Z" class="bumper" />
		<circle cx="44" cy="70" r="17" class="tire" />
		<circle cx="44" cy="70" r="9" class="wheel" />
		<circle cx="44" cy="70" r="4" class="hub" />
		<circle cx="145" cy="70" r="17" class="tire" />
		<circle cx="145" cy="70" r="9" class="wheel" />
		<circle cx="145" cy="70" r="4" class="hub" />
		<rect x="63" y="-4" width="51" height="6" rx="3" class="bumper" />
		<rect x="72" y="-19" width="33" height="15" rx="4" class="luggage" />
		<path d="M80-18v13m17-13v13" class="car-detail" />
	</g>
</svg>

<style>
	.ride-scene {
		display: block;
		width: 100%;
	}

	.sun {
		fill: white;
		opacity: 0.8;
	}

	.sun-ring {
		stroke: white;
		opacity: 0.55;
	}

	.far-hills {
		fill: var(--color-primary-teal);
		opacity: 0.1;
	}

	.near-hills {
		fill: var(--color-primary-teal);
		opacity: 0.14;
	}

	.foreground {
		fill: var(--color-primary-teal);
		opacity: 0.09;
	}

	.road-edge {
		stroke: var(--color-light-teal);
		stroke-width: 28;
	}

	.road {
		stroke: white;
		stroke-width: 20;
	}

	.road-line {
		stroke: var(--color-primary-teal);
		stroke-width: 1.5;
		stroke-dasharray: 7 9;
		opacity: 0.35;
	}

	.tree {
		color: var(--color-deep-teal);
		opacity: 0.55;
	}

	.small-tree {
		opacity: 0.3;
	}

	.car-shadow {
		fill: var(--color-deep-teal);
		opacity: 0.12;
	}

	.car-body {
		fill: var(--color-deep-teal);
	}

	.car-roof {
		fill: var(--color-primary-teal);
	}

	.car-window {
		fill: var(--color-light-teal);
	}

	.car-detail {
		stroke: var(--color-text-primary);
		stroke-width: 1.3;
		opacity: 0.3;
	}

	.car-light {
		fill: var(--color-light-teal);
	}

	.bumper, .tire {
		fill: var(--color-text-primary);
	}

	.wheel {
		fill: var(--color-bg);
	}

	.hub {
		fill: var(--color-text-muted);
	}

	.luggage {
		fill: var(--color-primary-teal);
	}
</style>
