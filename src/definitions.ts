import { type Disposable, Location, languages, type Position, type TextDocument, Uri, workspace } from 'vscode';

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

async function findDefinitions(name: string): Promise<Location[]> {
	const locations: Location[] = [];
	const files = await workspace.findFiles(NSIS_GLOB);

	for (const file of files) {
		const document = await workspace.openTextDocument(file);

		for (let i = 0; i < document.lineCount; i++) {
			const line = document.lineAt(i);

			for (const pattern of Object.values(DEFINITION_PATTERNS)) {
				const match = pattern.exec(line.text);

				if (match?.[1] === name) {
					const nameStart = line.text.indexOf(name, match.index);
					locations.push(
						new Location(
							document.uri,
							document.positionAt(document.offsetAt(document.lineAt(i).range.start) + nameStart),
						),
					);
					break;
				}
			}
		}
	}

	return locations;
}

export function registerDefinitionProvider(): Disposable {
	return languages.registerDefinitionProvider('nsis', {
		async provideDefinition(document, position) {
			const word = getWordAtPosition(document, position);

			if (!word) {
				return [];
			}

			return findDefinitions(word);
		},
	});
}
