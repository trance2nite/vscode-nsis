import { platform } from 'node:os';
import { dirname, isAbsolute, join, parse } from 'node:path';
import { nsisDir } from 'makensis';
import { type Disposable, DocumentLink, languages, Range, type TextDocument, Uri } from 'vscode';
import { fileExists, getMakensisPath } from './util';

const INCLUDE_REGEX =
	/(?:!include)\s+(?:\/\w+\s+)*(?:"([^"]+)"|'([^']+)'|(\S+))|(?:LoadLanguageFile)\s+(?:"([^"]+)"|'([^']+)'|(\S+))/i;

// biome-ignore lint/suspicious/noTemplateCurlyInString: This is a literal NSIS variable, not a JS template placeholder
const NSISDIR_VAR = '${NSISDIR}';

let cachedNsisDir: string | null | undefined;

async function getNsisDirectory(): Promise<string | null> {
	if (cachedNsisDir !== undefined) {
		return cachedNsisDir;
	}

	try {
		const pathToMakensis = await getMakensisPath();
		const options = pathToMakensis !== 'makensis' ? { pathToMakensis } : {};
		const result = await nsisDir(options);

		if (typeof result === 'string') {
			cachedNsisDir = result;
		} else if (result && typeof result === 'object' && 'nsisdir' in result) {
			cachedNsisDir = result.nsisdir;
		} else {
			cachedNsisDir = null;
		}
	} catch {
		cachedNsisDir = null;
	}

	return cachedNsisDir;
}

async function resolveIncludePath(currentFilePath: string, inputPath: string): Promise<string | null> {
	const nsisDirectory = await getNsisDirectory();
	let resolvedPath = inputPath;

	if (resolvedPath.includes(NSISDIR_VAR)) {
		if (!nsisDirectory) {
			return null;
		}

		if (platform() !== 'win32') {
			resolvedPath = resolvedPath.replace(/\\/g, '/');
		}

		resolvedPath = resolvedPath.replace(/\$\{NSISDIR\}/gi, nsisDirectory);
	}

	const { dir: targetDir, ext: targetExt, name: targetName } = parse(resolvedPath);
	const filename = targetName + targetExt;

	if (isAbsolute(resolvedPath)) {
		return (await fileExists(resolvedPath)) ? resolvedPath : null;
	}

	const candidates: string[] = [];

	if (nsisDirectory) {
		candidates.push(
			join(nsisDirectory, 'Include', filename),
			join(nsisDirectory, 'Include', `${targetName}.nsh`),
			join(nsisDirectory, 'Contrib', 'Language files', filename),
			join(nsisDirectory, 'Contrib', 'Language files', `${targetName}.nsh`),
		);
	}

	candidates.push(join(dirname(currentFilePath), targetDir, filename));

	for (const candidate of candidates) {
		if (await fileExists(candidate)) {
			return candidate;
		}
	}

	return null;
}

export function registerDocumentLinkProvider(): Disposable {
	return languages.registerDocumentLinkProvider('nsis', {
		async provideDocumentLinks(document: TextDocument) {
			const links: DocumentLink[] = [];
			const currentFilePath = document.uri.fsPath;

			if (!currentFilePath) {
				return links;
			}

			for (let i = 0; i < document.lineCount; i++) {
				const line = document.lineAt(i);
				const match = INCLUDE_REGEX.exec(line.text);

				if (!match) {
					continue;
				}

				const targetFile = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];

				if (!targetFile) {
					continue;
				}

				const matchIndex = line.text.indexOf(targetFile, match.index);

				if (matchIndex === -1) {
					continue;
				}

				const startPos = document.positionAt(document.offsetAt(line.range.start) + matchIndex);
				const endPos = document.positionAt(document.offsetAt(line.range.start) + matchIndex + targetFile.length);

				const resolved = await resolveIncludePath(currentFilePath, targetFile);

				if (resolved) {
					links.push(new DocumentLink(new Range(startPos, endPos), Uri.file(resolved)));
				}
			}

			return links;
		},
	});
}
