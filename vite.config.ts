import { defineConfig, type Plugin } from 'vite';

function strictCspPlugin(): Plugin {
		return {
			name: 'web-tetris-strict-csp',
			transformIndexHtml(html, context) {
				if (context?.server) {
					return html;
				}

				const metaPattern = /(<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=")([^"]*)(")([^>]*>)/i;
				return html.replace(metaPattern, (_match, prefix: string, value: string, quote: string, suffix: string) => {
					const normalized = normalizeCsp(value);
					return `${prefix}${normalized}${quote}${suffix}`;
				});
			},
		};
}

function normalizeCsp(value: string): string {
	const directives = value
		.split(';')
		.map((entry) => entry.trim())
		.filter(Boolean);

	const map = new Map<string, string[]>();
	for (const directive of directives) {
		const [name, ...sources] = directive.split(/\s+/);
		if (!name) {
			continue;
		}
		const existing = map.get(name) ?? [];
		map.set(name, [...existing, ...sources]);
	}

	const setDirective = (name: string, sources: string[]): void => {
		map.set(name, sources);
	};

	const getOr = (name: string, fallback: string[]): string[] => {
		return map.get(name) ?? fallback;
	};

	setDirective('default-src', ["'self'"]);
	setDirective('base-uri', ["'self'"]);
	setDirective('object-src', ["'none'"]);
	setDirective('script-src', ["'self'"]);
	setDirective('style-src', ["'self'"]);
	setDirective('img-src', uniqueSources(getOr('img-src', ["'self'", 'data:'])));
	setDirective('font-src', uniqueSources(getOr('font-src', ["'self'"])));
	setDirective('connect-src', ["'self'"]);
	setDirective('worker-src', ["'self'"]);
	setDirective('manifest-src', ["'self'"]);
	setDirective('media-src', uniqueSources(getOr('media-src', ["'self'", 'data:'])));

	const orderedNames = [
		'default-src',
		'base-uri',
		'object-src',
		'script-src',
		'style-src',
		'img-src',
		'font-src',
		'connect-src',
		'worker-src',
		'manifest-src',
		'media-src',
	];

	const result: string[] = [];
	for (const name of orderedNames) {
		const sources = map.get(name);
		if (!sources || sources.length === 0) {
			continue;
		}
		result.push(`${name} ${uniqueSources(sources).join(' ')}`);
		map.delete(name);
	}

	const remaining = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	for (const [name, sources] of remaining) {
		if (sources.length === 0) {
			result.push(name);
		} else {
			result.push(`${name} ${uniqueSources(sources).join(' ')}`);
		}
	}

	return result.join('; ');
}

function uniqueSources(sources: string[]): string[] {
	return [...new Set(sources.filter(Boolean))];
}

export default defineConfig({
	plugins: [strictCspPlugin()],
	build: {
		manifest: true,
	},
});
