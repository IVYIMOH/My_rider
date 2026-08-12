import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		VitePWA({
			strategies: 'generateSW',
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			manifest: {
				name: 'Sipi Rider — Ride with locals you trust',
				short_name: 'Sipi Rider',
				description:
					'Sipi Rider connects travelers with verified taxi-association drivers who know the roads, the stories, and the shortcuts.',
				theme_color: '#149AA0',
				background_color: '#F6FAFB',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/',
				scope: '/',
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/icons/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
				// Google Maps tiles / scripts are network-first, never cached stale
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/maps\.googleapis\.com\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'google-maps-cache',
							expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }
						}
					}
				]
			},
			devOptions: {
				enabled: false
			}
		})
	],
	server: {
		port: 5173
	}
});