<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { getConversations } from '$lib/api';
	import { ApiError } from '$lib/http';
	import type { Conversation } from '$lib/api';

	let activeTab = $state('messages');
	let conversations = $state<Conversation[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorCode = $state('');

	async function load() {
		loading = true;
		error = null;
		errorCode = '';
		try {
			conversations = await getConversations();
		} catch (e) {
			error = (e as Error).message;
			errorCode = e instanceof ApiError ? e.code : '';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2);
	}
</script>

<div class="app-frame flex flex-col h-full bg-white">
	<TopBar title="Inbox" onBack={() => history.back()} />

	<div class="flex-1 overflow-y-auto p-6">
		{#if loading}
			<div class="space-y-3">
				{#each Array(2) as _}
					<div class="h-16 animate-pulse rounded-2xl bg-slate-100"></div>
				{/each}
			</div>
		{:else if error}
			<ErrorState message={error} code={errorCode} retry={load} />
		{:else if conversations.length === 0}
			<div class="flex flex-col items-center justify-center py-14 text-center">
				<div class="w-14 h-14 bg-light-teal text-deep-teal rounded-full flex items-center justify-center text-xl mb-3">
					<Icon name="chat" size={24} class="text-primary-teal" />
				</div>
				<h2 class="text-body-lg font-semibold text-text-primary">No conversations yet</h2>
				<p class="text-caption text-text-muted mt-1 max-w-[220px]">Direct secure chats with your verified drivers will be saved here.</p>
			</div>
		{:else}
			<div class="flex flex-col divide-y divide-border rounded-2xl border border-border bg-white">
				{#each conversations as c}
					<div class="flex items-center gap-3 p-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-light-teal text-caption font-semibold text-deep-teal">
							{initials(c.partnerName)}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-body-lg font-semibold text-text-primary">{c.partnerName}</p>
							<p class="truncate text-caption text-text-muted">{c.lastMessage ?? 'Start a conversation'}</p>
						</div>
						<Icon name="chevron" size={14} class="text-text-muted" />
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<BottomNav bind:activeTab />
</div>
