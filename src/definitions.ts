import { type Disposable, Location, languages, type Position, type TextDocument, workspace } from 'vscode';

const NSIS_GLOB = '**/*.{nsi,nsh,bnsi,bnsh,nsdinc}';

const DEFINITION_PATTERNS = {
	function: /^\s*Function\s+(\.?\w+)/i,
	macro: /^\s*!macro\s+(\w+)/i,
	define: /^\s*!define\s+(?:\/\w+\s+)*(\w+)/i,
	variable: /^\s*Var\s+(?:\/GLOBAL\s+)?"?(\w+)"?/i,
	section: /^\s*(?:Section|SectionGroup)\s+(?:\/[oe]\s+)?(?:"[^"]*"\s+)?(\w+)/i,
};

const REFERENCE_PATTERNS = [
	/\$\{(\w+)\}/, // ${Define}
	/\$(\w+)/, // $Variable
	/Call\s+(\.?\w+)/i, // Call .function
	/!insertmacro\s+(\w+)/i, // !insertmacro MacroName
	/!(?:if|ifdef|ifndef|undef)\s+(\w+)/i, // !if, !ifdef, !ifndef, !undef
];

function isDefinitionLine(lineText: string): boolean {
	return Object.values(DEFINITION_PATTERNS).some((pattern) => pattern.test(lineText));
}

function isSymbolReference(lineText: string, word: string): boolean {
	return REFERENCE_PATTERNS.some((pattern) => {
		const match = pattern.exec(lineText);
		return match?.[1] === word;
	});
}

function getWordAtPosition(document: TextDocument, position: Position): string | undefined {
	const range = document.getWordRangeAtPosition(position, /[\w.]+/);
	return range ? document.getText(range) : undefined;
}

function findDefinitionsInDocument(document: TextDocument, name: string): Location[] {
	const locations: Location[] = [];

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

	return locations;
}

async function findDefinitions(currentDocument: TextDocument, name: string): Promise<Location[]> {
	const localResults = findDefinitionsInDocument(currentDocument, name);

	if (localResults.length > 0) {
		return localResults;
	}

	const locations: Location[] = [];
	const files = await workspace.findFiles(NSIS_GLOB);

	for (const file of files) {
		if (file.toString() === currentDocument.uri.toString()) {
			continue;
		}

		const document = await workspace.openTextDocument(file);
		locations.push(...findDefinitionsInDocument(document, name));
	}

	return locations;
}

export function registerDefinitionProvider(): Disposable {
	return languages.registerDefinitionProvider('nsis', {
		async provideDefinition(document, position) {
			const lineText = document.lineAt(position).text;

			if (isDefinitionLine(lineText)) {
				return [];
			}

			const word = getWordAtPosition(document, position);

			if (!word || !isSymbolReference(lineText, word)) {
				return [];
			}

			return findDefinitions(document, word);
		},
	});
}
