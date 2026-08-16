/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Kept in sync with the @theme tokens in src/app.css (authoritative).
				'primary-teal': '#14A4A0',
				'deep-teal': '#0D6F71',
				'light-teal': '#E6FDF7',
				bg: '#F6FAFB',
				'text-primary': '#0F172A',
				'text-muted': '#64748B',
				border: '#E2EAF0',
				success: '#1EA34A'
			},
			fontFamily: {
				sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
			},
			fontSize: {
				h1: ['22px', { lineHeight: '28px', fontWeight: '600' }],
				h2: ['18px', { lineHeight: '24px', fontWeight: '600' }],
				'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
				'body-rg': ['14px', { lineHeight: '20px', fontWeight: '400' }],
				caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
				btn: ['16px', { lineHeight: '20px', fontWeight: '500' }]
			},
			borderRadius: {
				card: '16px',
				pill: '999px'
			},
			boxShadow: {
				card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 12px 0 rgba(15, 23, 42, 0.05)',
				nav: '0 -1px 0 0 #E2E8F0'
			},
			maxWidth: {
				app: '430px'
			}
		}
	},
	plugins: []
};