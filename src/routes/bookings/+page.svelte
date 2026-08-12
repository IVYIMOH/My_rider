<script lang="ts">
	import StatusBar from '$lib/components/StatusBar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let activeTab = $state('bookings');
</script>

<div class="app-frame flex flex-col h-full bg-white">
	<StatusBar />
	<TopBar title="My Bookings" onBack={() => history.back()} />
	
	<div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
		<div class="w-14 h-14 bg-light-teal text-deep-teal rounded-full flex items-center justify-center text-xl mb-3">
			<Icon name="calendar" size={24} class="text-primary-teal" />
		</div>
		<h2 class="text-body-lg font-semibold text-text-primary">No upcoming rides</h2>
		<p class="text-caption text-text-muted mt-1 max-w-[220px]">Your scheduled and historical taxi association rides will appear here.</p>
	</div>

	<BottomNav bind:activeTab />
</div>
