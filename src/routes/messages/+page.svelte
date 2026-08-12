<script lang="ts">
	import StatusBar from '$lib/components/StatusBar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let activeTab = $state('messages');
</script>

<div class="app-frame flex flex-col h-full bg-white">
	<StatusBar />
	<TopBar title="Inbox" onBack={() => history.back()} />
	
	<div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
		<div class="w-14 h-14 bg-light-teal text-deep-teal rounded-full flex items-center justify-center text-xl mb-3">
			<Icon name="chat" size={24} class="text-primary-teal" />
		</div>
		<h2 class="text-body-lg font-semibold text-text-primary">No conversations yet</h2>
		<p class="text-caption text-text-muted mt-1 max-w-[220px]">Direct secure chats with your verified drivers will be saved here.</p>
	</div>

	<BottomNav bind:activeTab />
</div>
