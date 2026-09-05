import fs from 'node:fs/promises';
import path from 'node:path';

import { EmptyFileSystem, URI } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { DiagnosticSeverity } from 'vscode-languageserver-types';

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

    // `{ validation: true }` is required here: without it, the
    // DocumentBuilder still parses/links the document but never populates
    // `document.diagnostics`, so the check below silently never fires -
    // meaning grammars with parser errors (unbalanced braces, missing
    // terminals, etc.) or linking errors (references to undefined rules)
    // would otherwise be accepted as if they were valid. See
    // tests/validation/grammar-loader.test.js for a regression test
    // covering exactly this.
    await services.shared.workspace.DocumentBuilder.build([document], { validation: true });

    // Only Error-severity diagnostics (parser errors like unbalanced
    // braces, and linking errors like a reference to an undefined rule)
    // are treated as fatal. Warnings/Information/Hints - e.g. "this rule
    // is declared but never referenced" - are valid Langium and shouldn't
    // block a grammar that otherwise parses and links fine.
    const errors = (document.diagnostics ?? [])
        .filter(d => d.severity === DiagnosticSeverity.Error);

    if (errors.length) {
        throw new Error(
            "Grammar contains errors:\n" +
            errors.map(d => ` - ${d.message}`).join("\n")
        );
    }

    return document.parseResult.value;
}
