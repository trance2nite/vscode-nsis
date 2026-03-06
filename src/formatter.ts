import { createFormatter, type DentOptions } from '@nsis/dent';
import type { Disposable } from 'vscode';
import { languages, Range, TextEdit } from 'vscode';
import { getConfig } from 'vscode-get-config';

async function formatDocument(text: string, options: DentOptions): Promise<string> {
	const format = createFormatter(options);

	return format(text);
}

async function getFormatterOptions(editorTabSize: number): Promise<DentOptions> {
	const { formatter } = await getConfig('nsis');

	return {
		endOfLines: formatter.endOfLines === '(auto)' ? undefined : formatter.endOfLines,
		indentSize: formatter.indentSize ?? editorTabSize,
		trimEmptyLines: formatter.trimEmptyLines ?? true,
		useTabs: formatter.useTabs ?? true,
	};
}

export async function registerFormatter(): Promise<Disposable[] | undefined> {
	const documentFormatter = languages.registerDocumentFormattingEditProvider('nsis', {
		async provideDocumentFormattingEdits(document, vsOptions) {
			const options = await getFormatterOptions(vsOptions.tabSize);
			const original = document.getText();
			const formatted = await formatDocument(original, options);

			if (formatted === original) {
				return [];
			}

			const fullRange = new Range(document.positionAt(0), document.positionAt(original.length));

			return [TextEdit.replace(fullRange, formatted)];
		},
	});

	const rangeFormatter = languages.registerDocumentRangeFormattingEditProvider('nsis', {
		async provideDocumentRangeFormattingEdits(document, range, vsOptions) {
			const options = await getFormatterOptions(vsOptions.tabSize);
			const original = document.getText(range);
			const formatted = await formatDocument(original, options);

			if (formatted === original) {
				return [];
			}

			return [TextEdit.replace(range, formatted)];
		},
	});

	return [documentFormatter, rangeFormatter];
}
