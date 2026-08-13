import adapter from '@sveltejs/adapter-static';

export default {
	kit: {
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			fallback: 'index.html', // SPA mode, needed for Capacitor
			precompress: false
		})
	}
};

