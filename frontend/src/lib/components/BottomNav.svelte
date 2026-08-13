<script lang="ts">
	import { goto } from '$app/navigation';
	let { activeTab = $bindable('home') } = $props<{ activeTab?: string }>();

	function navigate(tabName: string, path: string) {
		activeTab = tabName;
		goto(path);
	}
</script>

<nav class="w-full h-16 border-t border-border bg-white flex items-center justify-around shrink-0 pb-1 z-30">
	<button 
		type="button"
		onclick={() => navigate('home', '/get-started')} 
		class="flex flex-col items-center gap-0.5 flex-1 py-1 transition {activeTab === 'home' ? 'text-primary-teal font-semibold' : 'text-text-muted'}"
	>
		<span class="text-lg">🏠</span><span class="text-[11px]">Home</span>
	</button>
	<button 
		type="button"
		onclick={() => navigate('bookings', '/bookings')} 
		class="flex flex-col items-center gap-0.5 flex-1 py-1 transition {activeTab === 'bookings' ? 'text-primary-teal font-semibold' : 'text-text-muted'}"
	>
		<span class="text-lg">📅</span><span class="text-[11px]">Bookings</span>
	</button>
	<button 
		type="button"
		onclick={() => navigate('messages', '/messages')} 
		class="flex flex-col items-center gap-0.5 flex-1 py-1 transition {activeTab === 'messages' ? 'text-primary-teal font-semibold' : 'text-text-muted'}"
	>
		<span class="text-lg">💬</span><span class="text-[11px]">Messages</span>
	</button>
	<button 
		type="button"
		onclick={() => navigate('profile', '/profile')} 
		class="flex flex-col items-center gap-0.5 flex-1 py-1 transition {activeTab === 'profile' ? 'text-primary-teal font-semibold' : 'text-text-muted'}"
	>
		<span class="text-lg">👤</span><span class="text-[11px]">Profile</span>
	</button>
</nav>
