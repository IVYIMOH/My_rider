<script lang="ts">
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import PhoneGate from '$lib/components/PhoneGate.svelte';
	import { getConversationMessages, sendMessage, getConversations } from '$lib/api';
	import { session, isAuthenticated } from '$lib/auth';
	import { ApiError } from '$lib/http';
	import type { Message } from '$lib/api';

	const conversationId = Number(page.params.id);

	let messages = $state<Message[]>([]);
	let partnerName = $state('Conversation');
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorCode = $state('');
	let draft = $state('');
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	let bottomEl = $state<HTMLDivElement | null>(null);

	const myId = $derived($session?.user.id ?? null);

	async function refresh() {
		if (!isAuthenticated()) return;
		try {
			messages = await getConversationMessages(conversationId);
		} catch {
			// transient polling error — keep the last known thread
		}
	}

	async function load() {
		if (!isAuthenticated()) return;
		loading = true;
		error = null;
		errorCode = '';
		try {
			const [thread, convos] = await Promise.all([getConversationMessages(conversationId), getConversations()]);
			messages = thread;
			partnerName = convos.find((c) => c.id === conversationId)?.partnerName ?? 'Conversation';
		} catch (e) {
			error = (e as Error).message;
			errorCode = e instanceof ApiError ? e.code : '';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
		const timer = setInterval(refresh, 4000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (bottomEl) tick().then(() => bottomEl?.scrollIntoView({ behavior: 'smooth' }));
	});

	async function handleSend() {
		const text = draft.trim();
		if (!text) return;
		sendError = null;
		sending = true;
		try {
			await sendMessage(conversationId, text);
			draft = '';
			await refresh();
		} catch (e) {
			sendError = (e as Error).message;
		} finally {
			sending = false;
		}
	}
</script>

<PhoneGate role="tourist" title="Sign in to view messages" onSuccess={load}>
	<div class="app-frame flex flex-col h-full bg-white">
		<TopBar title={partnerName} onBack={() => history.back()} />

		<div class="flex-1 overflow-y-auto p-4 space-y-2">
			{#if loading}
				<div class="space-y-3">
					{#each Array(4) as _}
						<div class="h-12 w-2/3 animate-pulse rounded-2xl bg-slate-100"></div>
					{/each}
				</div>
			{:else if error}
				<ErrorState message={error} code={errorCode} retry={load} />
			{:else if messages.length === 0}
				<div class="py-14 text-center">
					<p class="text-caption text-text-muted">No messages yet. Say hi to get the conversation started.</p>
				</div>
			{:else}
				{#each messages as m}
					<div class="flex {m.senderId === myId ? 'justify-end' : 'justify-start'}">
						<div class="max-w-[75%] rounded-2xl px-3 py-2 text-caption {m.senderId === myId ? 'bg-deep-teal text-white' : 'bg-slate-100 text-text-primary'}">
							<p class="whitespace-pre-wrap break-words">{m.body}</p>
							<p class="mt-0.5 text-[10px] opacity-60">{m.createdAt}</p>
						</div>
					</div>
				{/each}
				<div bind:this={bottomEl}></div>
			{/if}
		</div>

		{#if sendError}
			<p class="px-4 pb-2 text-caption font-medium text-red-600">{sendError}</p>
		{/if}

		<form
			class="flex gap-2 border-t border-border p-3"
			onsubmit={(e) => {
				e.preventDefault();
				handleSend();
			}}
		>
			<input
				class="field-input flex-1"
				type="text"
				placeholder="Type a message…"
				bind:value={draft}
				autocomplete="off"
			/>
			<button
				type="submit"
				class="flex shrink-0 items-center justify-center rounded-xl bg-deep-teal px-4 text-white"
				disabled={sending || !draft.trim()}
			>
				Send
			</button>
		</form>
	</div>
</PhoneGate>
