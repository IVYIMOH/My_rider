<script>
	import Icon from '$lib/components/Icon.svelte';

	const roles = [
		{
			href: '/get-started',
			icon: 'person',
			title: 'A Tourist',
			desc: 'Book rides, upload passport or national ID for verification.'
		},
		{
			href: '/onboarding/driver',
			icon: 'car',
			title: 'A Driver',
			desc: 'Complete KYC and prove your taxi association membership.'
		},
	];
</script>

<div class="app-frame">

	<div class="flex items-center gap-2 px-6 pt-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-teal text-sm font-bold text-white">
			S
		</div>
		<span class="text-body-lg font-semibold text-text-primary">SipiRider</span>
	</div>

	<div class="px-6 pt-6">
		<h1 class="text-[26px] font-semibold leading-tight text-text-primary">
			Explore anywhere.<br />
			<span class="text-primary-teal">Ride with locals you trust.</span>
		</h1>
		<p class="mt-3 text-body-rg text-text-muted">
			Sipi Rider connects travelers with verified taxi-association drivers who know the roads,
			the stories, and the shortcuts.
		</p>
	</div>

	<!-- Signature illustration: skyline + car, built from flat shapes in brand colors -->
	<div class="mt-4 px-6">
		<svg viewBox="0 0 400 140" class="w-full">
			<rect x="0" y="60" width="46" height="70" fill="#E6F6F7" />
			<rect x="52" y="30" width="40" height="100" fill="#F1F5F6" />
			<rect x="98" y="70" width="34" height="60" fill="#E6F6F7" />
			<circle cx="330" cy="45" r="26" fill="#E6F6F7" />
			<g stroke="#149AA0" stroke-width="1.4" opacity="0.5">
				<line x1="8" y1="72" x2="8" y2="118" />
				<line x1="20" y1="72" x2="20" y2="118" />
				<line x1="32" y1="72" x2="32" y2="118" />
			</g>
			<path
				d="M60 132c40-4 70 6 100-2 34-9 60 4 92-2 30-6 58 2 88-3"
				fill="none"
				stroke="#CBD5E1"
				stroke-width="2"
			/>
			<g transform="translate(150,88)">
				<rect x="0" y="14" width="120" height="26" rx="8" fill="#0D6F75" />
				<path d="M14 14 28 0h64l14 14z" fill="#149AA0" />
				<rect x="34" y="4" width="52" height="12" rx="2" fill="#E6F6F7" opacity="0.6" />
				<circle cx="28" cy="42" r="10" fill="#0F172A" />
				<circle cx="28" cy="42" r="4" fill="#F6FAFB" />
				<circle cx="94" cy="42" r="10" fill="#0F172A" />
				<circle cx="94" cy="42" r="4" fill="#F6FAFB" />
			</g>
		</svg>
	</div>

	<div class="flex-1 px-6 pb-6 pt-6">
		<p class="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
			I'm joining as
		</p>
		<div class="flex flex-col gap-3">
			{#each roles as role}
				<a
					href={role.href}
					class="card flex items-center gap-3 transition active:scale-[0.98]"
				>
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-light-teal text-deep-teal">
						<Icon name={role.icon} size={19} />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-body-lg font-semibold text-text-primary">{role.title}</p>
						<p class="text-caption text-text-muted">{role.desc}</p>
					</div>
					<Icon name="chevron" size={18} class="text-text-muted" />
				</a>
			{/each}
		</div>

		<p class="mt-6 text-center text-caption text-text-muted">
			By continuing you agree to Sipi Rider's <span class="font-medium text-deep-teal">Terms</span>
			&amp; <span class="font-medium text-deep-teal">Privacy Policy</span>.
		</p>
	</div>
</div>