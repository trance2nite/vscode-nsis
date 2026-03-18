import { commands, type ExtensionContext, languages, window, workspace } from 'vscode';

export async function activate(context: ExtensionContext): Promise<void> {
	const { compile, showCompilerFlags, showVersion, showHelp } = await import('./makensis');
	const { convert } = await import('./nlf.ts');
	const { createTask } = await import('./task.ts');

	context.subscriptions.push(
		// TextEditor Commands
		commands.registerTextEditorCommand('extension.nsis.compile', async () => {
			return await compile(false);
		}),

		commands.registerTextEditorCommand('extension.nsis.compile-strict', async () => {
			return await compile(true);
		}),

		commands.registerTextEditorCommand('extension.nsis.create-build-task', async () => {
			return await createTask();
		}),

		commands.registerTextEditorCommand('extension.nsis.convert-language-file', () => {
			return convert();
		}),

		// Global Commands
		commands.registerCommand('extension.nsis.show-version', async () => {
			return await showVersion();
		}),

		commands.registerCommand('extension.nsis.show-compiler-flags', async () => {
			return await showCompilerFlags();
		}),

		commands.registerCommand('extension.nsis.command-reference', async () => {
			return await showHelp();
		}),

		commands.registerCommand('extension.nsis.open-settings', async () => {
			commands.executeCommand('workbench.action.openSettings', '@ext:idleberg.nsis');
		}),
	);

	// Formatter
	const { registerFormatter } = await import('./formatter.ts');
	const formatterDisposable = await registerFormatter();

	if (formatterDisposable) {
		context.subscriptions.push(formatterDisposable);
	}

	// Symbol Navigation
	const { registerDefinitionProvider } = await import('./definitions.ts');
	const { registerReferenceProvider } = await import('./references.ts');
	const { registerSymbolProvider } = await import('./symbols.ts');

	context.subscriptions.push(registerDefinitionProvider(), registerReferenceProvider(), registerSymbolProvider());

	// Diagnostics
	const { updateDiagnostics } = await import('./diagnostics.ts');
	const collection = languages.createDiagnosticCollection('nsis');

	if (window.activeTextEditor) {
		const editor = window.activeTextEditor;

		if (editor) {
			const document = editor.document || null;

			updateDiagnostics(document, collection);
		}
	}

	context.subscriptions.push(
		workspace.onDidSaveTextDocument(() => {
			const editor = window.activeTextEditor;

			if (editor) {
				const document = editor.document || null;

				updateDiagnostics(document, collection);
			}
		}),

		window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				const document = editor.document || null;

				updateDiagnostics(document, collection);
			}
		}),
	);
}
