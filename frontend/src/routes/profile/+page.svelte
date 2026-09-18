<script lang="ts">
	import { goto } from '$app/navigation';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import PhoneGate from '$lib/components/PhoneGate.svelte';
	import { getProfile, updateProfile, startPhoneChange, confirmPhoneChange } from '$lib/api';
	import { isAuthenticated, logout } from '$lib/auth';
	import { ApiError } from '$lib/http';

	let activeTab = $state('profile');
	let name = $state('');
	let accountId = $state('');
	let phone = $state<string | null>(null);
	let phoneVerified = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorCode = $state('');

	let editing = $state(false);
	let editName = $state('');
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);

	// Changing the phone number goes through an OTP round-trip, so it is its own
	// flow rather than a field on the profile form.
	let phoneStep = $state<'idle' | 'enter' | 'code'>('idle');
	let newPhone = $state('');
	let phoneCode = $state('');
	let pendingPhone = $state('');
	let phoneDevCode = $state<string | null>(null);
	let phoneBusy = $state(false);
	let phoneError = $state<string | null>(null);

	async function load() {
		if (!isAuthenticated()) return;
		loading = true;
		error = null;
		errorCode = '';
		try {
			const p = await getProfile();
			name = p.profile.name;
			accountId = `#${String(p.profile.id).padStart(5, '0')}`;
			phone = p.profile.phone;
			phoneVerified = p.profile.phoneVerified;
			editName = p.profile.name;
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

	async function saveProfile() {
		saveError = null;
		saveSuccess = false;
		saving = true;
		try {
			await updateProfile({ name: editName });
			saveSuccess = true;
			editing = false;
			await load();
			setTimeout(() => (saveSuccess = false), 2500);
		} catch (e) {
			saveError = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	async function requestPhoneCode() {
		phoneError = null;
		phoneBusy = true;
		try {
			const r = await startPhoneChange(newPhone);
			pendingPhone = r.phone;
			phoneDevCode = r.devCode ?? null;
			phoneCode = '';
			phoneStep = 'code';
		} catch (e) {
			phoneError = (e as Error).message;
		} finally {
			phoneBusy = false;
		}
	}

	async function confirmPhoneCode() {
		phoneError = null;
		phoneBusy = true;
		try {
			await confirmPhoneChange(pendingPhone, phoneCode.trim());
			resetPhoneFlow();
			await load();
		} catch (e) {
			phoneError = (e as Error).message;
		} finally {
			phoneBusy = false;
		}
	}

	function resetPhoneFlow() {
		phoneStep = 'idle';
		newPhone = '';
		phoneCode = '';
		pendingPhone = '';
		phoneDevCode = null;
		phoneError = null;
	}

	function handleLogout() {
		logout();
		goto('/');
	}

	function initials(value: string) {
		return value
			.split(' ')
			.map((p) => p[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}
</script>

<PhoneGate role="tourist" title="Sign in to view your profile" onSuccess={load}>
	<div class="app-frame flex flex-col h-full bg-white">
		<TopBar title="Account Profile" onBack={() => history.back()} />

		<div class="flex-1 overflow-y-auto p-6 space-y-4">
			{#if loading}
				<div class="h-24 animate-pulse rounded-2xl bg-slate-100"></div>
			{:else if error}
				<ErrorState message={error} code={errorCode} retry={load} />
			{:else}
			<div class="card flex items-center gap-4">
				<div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-lg font-bold text-text-primary">
					{initials(name)}
				</div>
				<div class="min-w-0 flex-1">
					<h2 class="text-body-lg font-semibold text-text-primary truncate">{name}</h2>
					<p class="text-caption text-text-muted">Account ID: {accountId}</p>
				</div>
				{#if !editing}
					<button type="button" class="border border-border bg-white px-3 py-1.5 rounded-xl text-caption font-semibold text-text-primary hover:bg-slate-50" onclick={() => (editing = true)}>
						Edit
					</button>
				{/if}
			</div>

			{#if editing}
				<div class="card space-y-4 p-4">
					<div>
						<label class="field-label" for="edit-name">Full name</label>
						<input id="edit-name" class="field-input" type="text" bind:value={editName} />
					</div>
					{#if saveError}
						<p class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-caption font-medium text-red-700">{saveError}</p>
					{/if}
					{#if saveSuccess}
						<p class="rounded-xl border border-success/30 bg-light-teal px-3 py-2 text-caption font-medium text-success">Profile saved.</p>
					{/if}
					<div class="flex gap-2">
						<button type="button" class="btn-primary flex-1" disabled={saving} onclick={saveProfile}>
							{saving ? 'Saving…' : 'Save changes'}
						</button>
						<button type="button" class="border border-border bg-white rounded-xl px-4 py-2 text-caption font-semibold text-text-primary hover:bg-slate-50" onclick={() => { editing = false; saveError = null; saveSuccess = false; }}>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<div class="card">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-caption font-semibold uppercase tracking-wide text-text-muted">Phone number</p>
						<p class="mt-1 text-body-rg text-text-primary">{phone ?? 'Not set'}</p>
					</div>
					{#if phoneVerified}
						<span class="flex items-center gap-1 rounded-full bg-light-teal px-2 py-1 text-caption font-semibold text-deep-teal">
							<Icon name="check" size={12} />
							Verified
						</span>
					{:else}
						<span class="rounded-full border border-border px-2 py-1 text-caption font-medium text-text-muted">
							Unverified
						</span>
					{/if}
				</div>

				{#if phoneStep === 'idle'}
					<button
						type="button"
						class="mt-3 w-full rounded-xl border border-border bg-white py-2 text-caption font-semibold text-text-primary hover:bg-slate-50"
						onclick={() => (phoneStep = 'enter')}
					>
						Change phone number
					</button>
				{:else if phoneStep === 'enter'}
					<div class="mt-3 space-y-2 border-t border-border pt-3">
						<label class="field-label" for="new-phone">New phone number</label>
						<input
							id="new-phone"
							class="field-input"
							type="tel"
							inputmode="tel"
							placeholder="+256 7xx xxx xxx"
							bind:value={newPhone}
						/>
						<p class="text-[11px] text-text-muted">
							We'll text a code to this number. It only replaces your current one once you enter the code.
						</p>
						{#if phoneError}
							<p class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-caption font-medium text-red-700">{phoneError}</p>
						{/if}
						<div class="flex gap-2">
							<button type="button" class="btn-primary flex-1" disabled={phoneBusy || !newPhone.trim()} onclick={requestPhoneCode}>
								{phoneBusy ? 'Sending…' : 'Send code'}
							</button>
							<button type="button" class="rounded-xl border border-border bg-white px-4 py-2 text-caption font-semibold text-text-primary hover:bg-slate-50" onclick={resetPhoneFlow}>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<div class="mt-3 space-y-2 border-t border-border pt-3">
						<p class="text-caption text-text-muted">
							Enter the code we sent to <span class="font-semibold text-text-primary">{pendingPhone}</span>.
						</p>
						{#if phoneDevCode}
							<p class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700">
								Dev mode — your code is <span class="font-bold">{phoneDevCode}</span>
							</p>
						{/if}
						<input
							class="field-input text-center text-lg font-semibold tracking-[0.4em]"
							type="text"
							inputmode="numeric"
							autocomplete="one-time-code"
							maxlength="6"
							placeholder="000000"
							bind:value={phoneCode}
						/>
						{#if phoneError}
							<p class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-caption font-medium text-red-700">{phoneError}</p>
						{/if}
						<div class="flex gap-2">
							<button type="button" class="btn-primary flex-1" disabled={phoneBusy || phoneCode.trim().length !== 6} onclick={confirmPhoneCode}>
								{phoneBusy ? 'Checking…' : 'Confirm'}
							</button>
							<button type="button" class="rounded-xl border border-border bg-white px-4 py-2 text-caption font-semibold text-text-primary hover:bg-slate-50" onclick={resetPhoneFlow}>
								Cancel
							</button>
						</div>
					</div>
				{/if}
			</div>

			<div class="space-y-2">
				<button class="w-full card p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition" onclick={handleLogout}>
					<span class="text-body-rg text-text-primary font-medium">Log out</span>
					<Icon name="chevron" size={14} class="text-text-muted" />
				</button>
			</div>
			{/if}
		</div>

		<BottomNav bind:activeTab />
	</div>
</PhoneGate>
