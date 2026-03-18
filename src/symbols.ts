import { type Disposable, DocumentSymbol, languages, Range, SymbolKind } from 'vscode';

const DEFINITION_PATTERNS = [
	{ pattern: /^\s*Function\s+(\.?\w+)/i, kind: SymbolKind.Function },
	{ pattern: /^\s*!macro\s+(\w+)/i, kind: SymbolKind.Function },
	{ pattern: /^\s*!define\s+(?:\/\w+\s+)*(\w+)/i, kind: SymbolKind.Constant },
	{ pattern: /^\s*Var\s+(?:\/GLOBAL\s+)?"?(\w+)"?/i, kind: SymbolKind.Variable },
	{ pattern: /^\s*(?:Section|SectionGroup)\s+(?:\/[oe]\s+)?(?:"[^"]*"\s+)(\w+)/i, kind: SymbolKind.Module },
	{ pattern: /^\s*(?:Section|SectionGroup)\s+(?:\/[oe]\s+)?(?:"([^"]+)"|(\w[\w.-]*))\s*$/i, kind: SymbolKind.Module },
];

export function registerSymbolProvider(): Disposable {
	return languages.registerDocumentSymbolProvider('nsis', {
		provideDocumentSymbols(document) {
			const symbols: DocumentSymbol[] = [];

			for (let i = 0; i < document.lineCount; i++) {
				const line = document.lineAt(i);

				for (const { pattern, kind } of DEFINITION_PATTERNS) {
					const match = pattern.exec(line.text);

					const name = match?.[1] || match?.[2];

					if (name) {
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
