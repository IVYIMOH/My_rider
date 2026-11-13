<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RideScene from '$lib/components/RideScene.svelte';

	const shortcuts = [
		{ href: '/get-started', icon: 'car', title: 'Ride', description: 'Get going' },
		{ href: '/map', icon: 'compass', title: 'Explore', description: 'Discover Sipi' },
		{ href: '/bookings', icon: 'bookings', title: 'My trips', description: 'Your bookings' }
	];
</script>

<svelte:head>
	<title>SipiRider — Go places. Feel at home.</title>
	<meta name="description" content="Explore with local drivers you can trust. Book a ride, discover Sipi, or join SipiRider as a verified taxi-association driver." />
</svelte:head>

<div class="app-frame home-screen">
	<header class="home-header">
		<a class="brand" href="/" aria-label="SipiRider home">
			<span class="brand-mark" aria-hidden="true"><Icon name="pin" size={23} /></span>
			<span>Sipi<span class="brand-accent">Rider</span><span class="brand-dot">.</span></span>
		</a>
		<a href="/profile" class="account-link" aria-label="Your account">
			<Icon name="profile" size={21} />
		</a>
	</header>

	<main class="home-content">
		<section class="journey-hero" aria-labelledby="welcome-title">
			<div class="hero-copy">
				<p class="eyebrow">A local connection. Every ride.</p>
				<h1 id="welcome-title">Go places.<br /><span>Feel at home.</span></h1>
			</div>
			<div class="hero-scene"><RideScene /></div>
			<span class="hero-caption"><span aria-hidden="true"></span> Your next adventure starts here</span>
		</section>

		<a href="/get-started" class="ride-action">
			<span class="ride-action-icon" aria-hidden="true"><Icon name="search" size={23} /></span>
			<span class="ride-action-copy"><strong>Where are you headed?</strong><span>Find your next ride</span></span>
			<Icon name="arrow-right" size={23} />
		</a>

		<section class="shortcuts-section" aria-labelledby="shortcuts-title">
			<div class="section-heading">
				<h2 id="shortcuts-title">Let's get moving</h2>
				<span>Made for your everyday</span>
			</div>
			<div class="shortcuts">
				{#each shortcuts as shortcut}
					<a href={shortcut.href} class="shortcut">
						<span class="shortcut-visual" aria-hidden="true"><Icon name={shortcut.icon} size={31} /></span>
						<strong>{shortcut.title}</strong>
						<span class="shortcut-description">{shortcut.description}</span>
					</a>
				{/each}
			</div>
		</section>

		<section class="trust-note" aria-labelledby="trust-title">
			<span class="trust-icon" aria-hidden="true"><Icon name="shield" size={26} /></span>
			<div>
				<h2 id="trust-title">Local drivers. Peace of mind.</h2>
				<p>Ride with verified taxi-association drivers<br class="wide-break" /> who know the way.</p>
			</div>
		</section>

		<a class="driver-card" href="/onboarding/driver">
			<div>
				<span class="driver-eyebrow">Take the driver's seat</span>
				<h2>Know the roads? Join us.</h2>
				<span class="driver-link">Drive with SipiRider <Icon name="arrow-right" size={16} /></span>
			</div>
			<span class="driver-art" aria-hidden="true"><Icon name="steering" size={43} /></span>
		</a>
	</main>

	<div class="home-navigation"><BottomNav activeTab="home" /></div>
</div>

<style>
	.home-screen {
		background: white;
		--home-gutter: 22px;
	}

	.home-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: calc(20px + env(safe-area-inset-top, 0px)) var(--home-gutter) 18px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		font-size: 23px;
		font-weight: 750;
		letter-spacing: -1px;
	}

	.brand-mark {
		display: grid;
		place-items: center;
		width: 34px;
		height: 38px;
		border-radius: 12px;
		background: var(--color-deep-teal);
		color: white;
	}

	.brand-accent, .brand-dot {
		color: var(--color-deep-teal);
	}

	.brand-dot {
		color: var(--color-primary-teal);
	}

	.account-link {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		color: var(--color-text-primary);
	}

	.home-content {
		display: flex;
		flex: 1;
		flex-direction: column;
		padding: 0 var(--home-gutter) 24px;
	}

	.journey-hero {
		position: relative;
		isolation: isolate;
		height: 250px;
		overflow: hidden;
		border-radius: 22px;
		background: var(--color-light-teal);
	}

	.hero-copy {
		position: relative;
		z-index: 1;
		padding: 22px 22px 0;
	}

	.eyebrow {
		color: var(--color-deep-teal);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 1.25px;
		text-transform: uppercase;
	}

	h1 {
		margin-top: 10px;
		font-size: 34px;
		font-weight: 750;
		line-height: 1.12;
		letter-spacing: -1.5px;
	}

	h1 span {
		color: var(--color-deep-teal);
	}

	.hero-scene {
		position: absolute;
		inset: auto 0 0;
		z-index: -1;
	}

	.hero-caption {
		position: absolute;
		bottom: 13px;
		left: 22px;
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-deep-teal);
		font-size: 10px;
		font-weight: 550;
	}

	.hero-caption > span {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--color-primary-teal);
	}

	.ride-action {
		display: flex;
		align-items: center;
		gap: 13px;
		min-height: 72px;
		margin-top: 14px;
		padding: 13px 17px;
		border-radius: 17px;
		background: var(--color-deep-teal);
		color: white;
		box-shadow: 0 5px 12px color-mix(in srgb, var(--color-deep-teal) 13%, transparent);
	}

	.ride-action-icon {
		display: grid;
		place-items: center;
	}

	.ride-action-copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
	}

	.ride-action-copy strong {
		font-size: 16px;
		font-weight: 650;
		letter-spacing: -0.3px;
	}

	.ride-action-copy > span {
		color: var(--color-light-teal);
		font-size: 11px;
	}

	.shortcuts-section {
		margin-top: 25px;
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 12px;
	}

	.section-heading h2 {
		font-size: 17px;
		font-weight: 700;
		letter-spacing: -0.5px;
	}

	.section-heading > span {
		color: var(--color-text-muted);
		font-size: 10px;
	}

	.shortcuts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.shortcut {
		display: flex;
		align-items: center;
		flex-direction: column;
		padding: 12px 3px 11px;
		border: 1px solid var(--color-border);
		border-radius: 17px;
		background: var(--color-bg);
		text-align: center;
	}

	.shortcut-visual {
		display: grid;
		place-items: center;
		width: 53px;
		height: 39px;
		margin-bottom: 5px;
		color: var(--color-deep-teal);
	}

	.shortcut strong {
		font-size: 13px;
		font-weight: 650;
	}

	.shortcut-description {
		margin-top: 2px;
		color: var(--color-text-muted);
		font-size: 10px;
	}

	.trust-note {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 22px 0;
	}

	.trust-icon {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 42px;
		height: 46px;
		color: var(--color-deep-teal);
	}

	.trust-note h2 {
		font-size: 13px;
		font-weight: 650;
	}

	.trust-note p {
		margin-top: 3px;
		color: var(--color-text-muted);
		font-size: 11px;
		line-height: 1.6;
	}

	.driver-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 16px 18px;
		border: 1px solid color-mix(in srgb, var(--color-primary-teal) 16%, white);
		border-radius: 17px;
		background: var(--color-light-teal);
	}

	.driver-eyebrow {
		color: var(--color-deep-teal);
		font-size: 9px;
		font-weight: 650;
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	.driver-card h2 {
		margin-top: 3px;
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.3px;
	}

	.driver-link {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-top: 7px;
		color: var(--color-deep-teal);
		font-size: 11px;
		font-weight: 650;
	}

	.driver-art {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 64px;
		height: 64px;
		border: 1px solid color-mix(in srgb, var(--color-primary-teal) 15%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-primary-teal) 9%, transparent);
		color: var(--color-deep-teal);
		transform: rotate(-18deg);
	}

	.home-navigation {
		position: sticky;
		bottom: 0;
		z-index: 30;
		margin-top: auto;
		overflow: hidden;
		background: white;
	}

	@media (hover: hover) {
		.ride-action:hover {
			background: color-mix(in srgb, var(--color-deep-teal) 90%, var(--color-text-primary));
		}
		.shortcut:hover, .account-link:hover {
			border-color: var(--color-primary-teal);
			background: var(--color-light-teal);
		}
		.driver-card:hover {
			border-color: var(--color-primary-teal);
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.ride-action, .shortcut, .driver-card, .account-link {
			transition: background 160ms, border-color 160ms, transform 160ms;
		}
		.ride-action:active, .shortcut:active, .driver-card:active {
			transform: scale(0.98);
		}
	}

	@media (max-width: 359px) {
		.home-screen {
			--home-gutter: 16px;
		}
		.hero-copy {
			padding-left: 18px;
		}
		h1 {
			font-size: 31px;
		}
		.section-heading > span {
			display: none;
		}
		.ride-action {
			gap: 10px;
			padding-inline: 13px;
		}
		.ride-action-copy strong {
			font-size: 15px;
		}
		.driver-art {
			width: 48px;
			height: 48px;
		}
		.driver-card {
			padding-inline: 14px;
		}
		.wide-break {
			display: none;
		}
	}

	@media (min-width: 640px) {
		.home-header {
			padding-top: 26px;
		}
		.home-navigation {
			border-radius: 0 0 2.5rem 2.5rem;
		}
	}
</style>
