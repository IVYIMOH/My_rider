<script lang="ts">
	import StatusBar from '$lib/components/StatusBar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let activeTab = $state('profile');
</script>

<div class="app-frame flex flex-col h-full bg-white">
	<StatusBar />
	<TopBar title="Account Profile" onBack={() => history.back()} />
	
	<div class="flex-1 p-6 space-y-4">
		<div class="card flex items-center gap-4">
			<div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-lg font-bold text-text-primary">UR</div>
			<div>
				<h2 class="text-body-lg font-semibold text-text-primary">SipiRider User</h2>
				<p class="text-caption text-text-muted">Account ID: #48291</p>
			</div>
		</div>

		<div class="space-y-2">
			<button class="w-full card p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition" onclick={() => location.href = '/'}>
				<span class="text-body-rg text-text-primary font-medium">Switch Roles / Log out</span>
				<Icon name="chevron" size={14} class="text-text-muted" />
			</button>
		</div>
	</div>

	<BottomNav bind:activeTab />
</div>
