import fs from 'node:fs/promises';
import path from 'node:path';

import { EmptyFileSystem, URI } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';

export async function loadGrammar(filename) {

    const services = createLangiumGrammarServices(EmptyFileSystem);

    const text = await fs.readFile(filename, 'utf8');

    const uri = URI.file(path.resolve(filename));

    const document =
        services.shared.workspace.LangiumDocumentFactory.fromString(
            text,
            uri
        );

    services.shared.workspace.LangiumDocuments.addDocument(document);

    await services.shared.workspace.DocumentBuilder.build([document]);

    if ((document.diagnostics ?? []).length) {
        throw new Error("Grammar contains errors.");
    }

    return document.parseResult.value;
}