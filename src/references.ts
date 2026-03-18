import { type Disposable, Location, languages, type Position, type TextDocument, workspace } from 'vscode';

const NSIS_GLOB = '**/*.{nsi,nsh,bnsi,bnsh,nsdinc}';

const DEFINITION_PATTERNS = {
	function: /^\s*Function\s+(\.?\w+)/i,
	macro: /^\s*!macro\s+(\w+)/i,
	define: /^\s*!define\s+(?:\/\w+\s+)*(\w+)/i,
	variable: /^\s*Var\s+(?:\/GLOBAL\s+)?"?(\w+)"?/i,
};

function getWordAtPosition(document: TextDocument, position: Position): string | undefined {
	const range = document.getWordRangeAtPosition(position, /[\w.]+/);
	return range ? document.getText(range) : undefined;
}

function getReferencePatterns(name: string): RegExp[] {
	const escaped = name.replace(/\./g, '\\.');

	return [
		// Function references: Call name, GetFunctionAddress ... name
		new RegExp(`\\b(?:Call|GetFunctionAddress\\s+\\S+)\\s+${escaped}\\b`, 'i'),
		// Macro references: !insertmacro name
		new RegExp(`^\\s*!insertmacro\\s+${escaped}\\b`, 'i'),
		// Define references: ${name}
		new RegExp(`\\$\\{${escaped}\\}`),
		// Variable references: $name
		new RegExp(`\\$${escaped}\\b`),
	];
}

function isDefinitionLine(line: string, name: string): boolean {
	for (const pattern of Object.values(DEFINITION_PATTERNS)) {
		const match = pattern.exec(line);

		if (match?.[1] === name) {
			return true;
		}
	}

	return false;
}

export function registerReferenceProvider(): Disposable {
	return languages.registerReferenceProvider('nsis', {
		async provideReferences(document, position, context) {
			const word = getWordAtPosition(document, position);

			if (!word) {
				return [];
			}

			const locations: Location[] = [];
			const patterns = getReferencePatterns(word);
			const files = await workspace.findFiles(NSIS_GLOB);

			for (const file of files) {
				const doc = await workspace.openTextDocument(file);

				for (let i = 0; i < doc.lineCount; i++) {
					const line = doc.lineAt(i);

					if (!context.includeDeclaration && isDefinitionLine(line.text, word)) {
						continue;
					}

					for (const pattern of patterns) {
						const match = pattern.exec(line.text);

						if (match) {
							const nameStart = line.text.indexOf(word, match.index);

							if (nameStart !== -1) {
								locations.push(new Location(doc.uri, doc.positionAt(doc.offsetAt(line.range.start) + nameStart)));
							}

							break;
						}
					}
				}
			}

			return locations;
		},
	});
}
