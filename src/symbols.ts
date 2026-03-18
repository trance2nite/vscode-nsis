import { type Disposable, DocumentSymbol, languages, type Position, Range, SymbolKind } from 'vscode';

const DEFINITION_PATTERNS = [
	{ pattern: /^\s*Function\s+(\.?\w+)/i, kind: SymbolKind.Function },
	{ pattern: /^\s*!macro\s+(\w+)/i, kind: SymbolKind.Function },
	{ pattern: /^\s*!define\s+(?:\/\w+\s+)*(\w+)/i, kind: SymbolKind.Constant },
	{ pattern: /^\s*Var\s+(?:\/GLOBAL\s+)?"?(\w+)"?/i, kind: SymbolKind.Variable },
];

export function registerSymbolProvider(): Disposable {
	return languages.registerDocumentSymbolProvider('nsis', {
		provideDocumentSymbols(document) {
			const symbols: DocumentSymbol[] = [];

			for (let i = 0; i < document.lineCount; i++) {
				const line = document.lineAt(i);

				for (const { pattern, kind } of DEFINITION_PATTERNS) {
					const match = pattern.exec(line.text);

					if (match?.[1]) {
						const name = match[1];
						const nameStart = line.text.indexOf(name, match.index);
						const nameRange = new Range(i, nameStart, i, nameStart + name.length);

						symbols.push(new DocumentSymbol(name, '', kind, line.range, nameRange));
						break;
					}
				}
			}

			return symbols;
		},
	});
}
