<script lang="ts">
	import { redirect } from '@sveltejs/kit';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { session, isAuthenticated, logout } from '$lib/auth';

	let { children } = $props();

	if (!isAuthenticated()) redirect(307, '/login');

	const nav = [
		{ href: '/overview', label: 'Overview', icon: 'dashboard' },
		{ href: '/pricing', label: 'Pricing', icon: 'wallet' },
		{ href: '/drivers', label: 'Drivers', icon: 'car' },
		{ href: '/users', label: 'Users', icon: 'users' }
	];

	const path = $derived(page.url.pathname);
	const currentUser = $derived($session?.user);
	const title = $derived(nav.find((n) => n.href === path)?.label ?? 'Overview');

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function signOut() {
		logout();
		goto('/login');
	}
</script>

<div class="flex min-h-dvh bg-bg">
	<aside class="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-white md:flex">
		<div class="flex h-16 items-center gap-2.5 border-b border-border px-6">
			<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-deep-teal text-lg font-bold text-white">
				S
			</div>
			<div>
				<p class="text-body-rg font-bold leading-none text-text-primary">SipiRider</p>
				<p class="mt-1 text-caption text-text-muted">Admin Console</p>
			</div>
		</div>

		<nav class="flex-1 space-y-1 p-4">
			{#each nav as item}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-body-rg font-medium transition {path === item.href
						? 'bg-light-teal font-semibold text-deep-teal'
						: 'text-text-muted hover:bg-slate-50 hover:text-text-primary'}"
				>
					<Icon name={item.icon} size={18} />
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="border-t border-border p-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-deep-teal text-sm font-semibold text-white"
				>
					{initials(currentUser?.name ?? '')}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-body-rg font-semibold text-text-primary">{currentUser?.name}</p>
					<p class="truncate text-caption text-text-muted">{currentUser?.email}</p>
				</div>
			</div>
			<button
				onclick={signOut}
				class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-body-rg font-medium text-text-muted transition hover:bg-slate-50 hover:text-text-primary"
			>
				<Icon name="logout" size={16} />
				Log out
			</button>
		</div>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-white/90 px-6 backdrop-blur">
			<div>
				<p class="text-caption font-semibold uppercase tracking-wide text-text-muted">Admin</p>
				<h1 class="mt-0.5 text-h2 leading-none text-text-primary">{title}</h1>
			</div>
			<div class="flex items-center gap-3">
				<span
					class="hidden items-center gap-1.5 rounded-full bg-light-teal px-3 py-1 text-caption font-semibold text-deep-teal sm:inline-flex"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-success"></span>
					Connected
				</span>
				<div
					class="flex h-9 w-9 items-center justify-center rounded-full bg-deep-teal text-xs font-semibold text-white md:hidden"
				>
					{initials(currentUser?.name ?? '')}
				</div>
			</div>
		</header>

		<nav class="flex gap-1 overflow-x-auto border-b border-border bg-white px-4 py-2 md:hidden">
			{#each nav as item}
				<a
					href={item.href}
					class="shrink-0 rounded-lg px-3 py-1.5 text-caption font-medium {path === item.href
						? 'bg-light-teal font-semibold text-deep-teal'
						: 'text-text-muted'}"
				>
					{item.label}
				</a>
			{/each}
		</nav>

		<main class="flex-1 px-6 py-8 lg:px-8">
			<div class="mx-auto max-w-5xl">
				{@render children()}
			</div>
		</main>
	</div>
</div>
