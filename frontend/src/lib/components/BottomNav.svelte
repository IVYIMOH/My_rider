<script lang="ts">
	import Icon from './Icon.svelte';

	let { activeTab = $bindable('home') } = $props<{ activeTab?: string }>();

	const tabs = [
		{ id: 'home', href: '/', icon: 'home', label: 'Home' },
		{ id: 'bookings', href: '/bookings', icon: 'bookings', label: 'Bookings' },
		{ id: 'map', href: '/map', icon: 'pin', label: 'Map' },
		{ id: 'messages', href: '/messages', icon: 'messages', label: 'Messages' },
		{ id: 'profile', href: '/profile', icon: 'profile', label: 'Profile' }
	];
</script>

<nav class="bottom-nav" aria-label="Main navigation">
	{#each tabs as tab}
		<a
			href={tab.href}
			class:active={activeTab === tab.id}
			aria-current={activeTab === tab.id ? 'page' : undefined}
			onclick={() => activeTab = tab.id}
		>
			<span class="nav-icon" aria-hidden="true"><Icon name={tab.icon} size={21} /></span>
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		position: relative;
		z-index: 30;
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-around;
		width: 100%;
		min-height: 74px;
		padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--color-border);
		background: white;
	}

	a {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		min-width: 0;
		min-height: 48px;
		border-radius: 10px;
		color: var(--color-text-muted);
		font-size: 10px;
		font-weight: 500;
	}

	.nav-icon {
		display: grid;
		place-items: center;
		width: 46px;
		height: 29px;
		border-radius: 10px;
	}

	a.active {
		color: var(--color-deep-teal);
		font-weight: 700;
	}

	.active .nav-icon {
		background: var(--color-light-teal);
	}

	@media (hover: hover) {
		a:hover {
			color: var(--color-deep-teal);
			background: var(--color-bg);
		}
	}
</style>
