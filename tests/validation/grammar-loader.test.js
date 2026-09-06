// Validates generate_blockly/src/grammar-loader.js: does it produce a
// usable Grammar AST for well-formed .langium files, and does it actually
// *reject* malformed ones? (loadGrammar is the very first pipeline stage -
// if it silently accepts broken input, every later stage inherits garbage.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { loadGrammar } from '../../generate_blockly/src/grammar-loader.js';
import { inputPath, REPO_ROOT } from '../helpers/pipeline.js';

const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures');

test('loadGrammar parses a well-formed grammar and exposes its rules', async () => {
    const grammar = await loadGrammar(inputPath('todo_list.langium'));
    const ruleNames = grammar.rules.map(r => r.name);

    assert.ok(ruleNames.includes('Model'));
    assert.ok(ruleNames.includes('Task'));
});

test('loadGrammar rejects a grammar with a parser error (unterminated rule)', async () => {
    await assert.rejects(
        () => loadGrammar(path.join(FIXTURES_DIR, 'syntax-error.langium')),
        /Grammar contains errors/
    );
});

test('loadGrammar rejects a grammar with a linking error (rule name collides with grammar name)', async () => {
    // Regression fixture: generate_blockly/input/adress_book.langium used
    // to declare `grammar AddressBook` *and* `entry AddressBook: ...` -
    // Langium treats that as a naming conflict. This used to be silently
    // swallowed because loadGrammar never asked the DocumentBuilder to
    // run validation (see the fix in grammar-loader.js). We keep a
    // minimal fixture reproducing that shape so the check doesn't regress.
    const brokenSource = `
grammar Broken
entry Broken:
    'x' name=ID;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
hidden terminal WS: /\\s+/;
`;
    const fs = await import('node:fs/promises');
    const tmp = path.join(FIXTURES_DIR, '__generated-name-collision.langium');
    await fs.writeFile(tmp, brokenSource);
    try {
        await assert.rejects(
            () => loadGrammar(tmp),
            /already used here as grammar name/
        );
    } finally {
        await fs.rm(tmp, { force: true });
    }
});

test('loadGrammar tolerates non-fatal diagnostics (e.g. an unused declared rule)', async () => {
    // A rule that's declared but never referenced is only a Hint-severity
    // diagnostic in Langium, not an Error - loadGrammar should not treat
    // it as fatal (see the severity filter in grammar-loader.js).
    const fs = await import('node:fs/promises');
    const source = `
grammar HasUnusedRule
entry Model:
    'model' name=ID;
Unused:
    'unused' name=ID;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
hidden terminal WS: /\\s+/;
`;
    const tmp = path.join(FIXTURES_DIR, '__generated-unused-rule.langium');
    await fs.writeFile(tmp, source);
    try {
        const grammar = await loadGrammar(tmp);
        assert.deepEqual(grammar.rules.map(r => r.name).sort(), ['ID', 'Model', 'Unused', 'WS']);
    } finally {
        await fs.rm(tmp, { force: true });
    }
});

test('every bundled example grammar in generate_blockly/input/ loads without error', async () => {
    const examples = [
        'todo_list.langium',
        'state_machine.langium',
        'recipe.langium',
        'adress_book.langium',
        'grammar.langium',
        'invalid.langium'
    ];

    for (const filename of examples) {
        await assert.doesNotReject(
            () => loadGrammar(inputPath(filename)),
            `${filename} should load cleanly`
        );
    }
});
