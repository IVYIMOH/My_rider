<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { getUsers, updateUserStatus } from '$lib/api';
	import { ApiError } from '$lib/http';
	import type { User, UserStatus } from '$lib/types';

	let users = $state<User[]>([]);
	let loading = $state(true);
	let updating = $state<number | null>(null);
	let error = $state<string | null>(null);
	let errorCode = $state('');

	async function load() {
		loading = true;
		error = null;
		errorCode = '';
		try {
			users = await getUsers();
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

	async function setStatus(u: User, status: UserStatus) {
		updating = u.id;
		const prev = u.status;
		u.status = status;
		try {
			await updateUserStatus(u.id, status);
		} catch (e) {
			u.status = prev;
			error = (e as Error).message;
			errorCode = e instanceof ApiError ? e.code : '';
		} finally {
			updating = null;
		}
	}

	function initials(name: string) {
		return name
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2);
	}
</script>

{#if loading}
	<div class="grid gap-3">
		{#each Array(3) as _}
			<div class="h-16 animate-pulse rounded-2xl bg-slate-100"></div>
		{/each}
	</div>
{:else if error}
	<ErrorState message={error} code={errorCode} retry={load} />
{:else if users.length === 0}
	<div class="card flex flex-col items-center justify-center py-12 text-center">
		<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-light-teal text-deep-teal">
			<Icon name="users" size={22} class="text-primary-teal" />
		</div>
		<h2 class="text-body-lg font-semibold text-text-primary">No users yet</h2>
		<p class="mt-1 text-caption text-text-muted">Registered users will appear here.</p>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#each users as u}
			<div class="card flex flex-col gap-3 sm:flex-row sm:items-center">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-caption font-semibold text-text-primary"
				>
					{initials(u.name)}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-body-lg font-semibold text-text-primary">{u.name}</p>
					<p class="text-caption text-text-muted">
						{u.role} · joined {u.joinedAt}
					</p>
				</div>
				<span class="chip {u.status === 'Active' ? 'chip-active' : ''}">{u.status}</span>
				<div class="flex items-center gap-2">
					{#if u.status === 'Pending'}
						<button
							type="button"
							onclick={() => setStatus(u, 'Active')}
							disabled={updating === u.id}
							class="btn-primary shrink-0 text-caption"
						>
							Approve
						</button>
						<button
							type="button"
							onclick={() => setStatus(u, 'Suspended')}
							disabled={updating === u.id}
							class="btn-secondary shrink-0 text-caption"
						>
							Reject
						</button>
					{:else if u.status === 'Active'}
						<button
							type="button"
							onclick={() => setStatus(u, 'Suspended')}
							disabled={updating === u.id}
							class="btn-secondary shrink-0 text-caption"
						>
							Suspend
						</button>
					{:else}
						<button
							type="button"
							onclick={() => setStatus(u, 'Active')}
							disabled={updating === u.id}
							class="btn-primary shrink-0 text-caption"
						>
							Reactivate
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
