import { defineConfig } from 'tsdown';

export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: ['@nsis/dent', '@nsis/nlf', 'makensis', 'micromatch', 'open', 'vscode-get-config', 'which'],
		neverBundle: ['vscode'],
		onlyAllowBundle: false,
	},
	entry: ['src/index.ts'],
	format: 'cjs',
	minify: true,
	outDir: 'lib',
	platform: 'node',
	target: 'es2020',
	treeshake: true,
});
