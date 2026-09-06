// Validates generate_blockly/src/validator.js: it should accept every
// grammar built purely from the documented supported subset (Group,
// Alternatives, Assignment, Keyword, RuleCall, CrossReference, and
// cardinalities ?/*/+), and reject - with a clear, itemised message -
// anything that uses a construct outside that subset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { loadGrammar } from '../../generate_blockly/src/grammar-loader.js';
import { validateGrammar, DEFAULT_ALLOWED_TYPES } from '../../generate_blockly/src/validator.js';
import { inputPath, REPO_ROOT } from '../helpers/pipeline.js';

const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures');

test('validateGrammar accepts every bundled example grammar', async () => {
    const examples = [
        'todo_list.langium',
        'state_machine.langium',
        'recipe.langium',
        'adress_book.langium',
        'grammar.langium',
        'invalid.langium' // uses CrossReference - part of the supported subset
    ];

    for (const filename of examples) {
        const grammar = await loadGrammar(inputPath(filename));
        assert.equal(validateGrammar(grammar), true, `${filename} should validate`);
    }
});

test('validateGrammar rejects UnorderedGroup ("&") with a message naming the construct and rule', async () => {
    const grammar = await loadGrammar(path.join(FIXTURES_DIR, 'unordered-group.langium'));

    assert.throws(
        () => validateGrammar(grammar),
        (err) => {
            assert.match(err.message, /unsupported node type "UnorderedGroup"/);
            assert.match(err.message, /rule "Pair"/);
            return true;
        }
    );
});

test('validateGrammar reports every violation, not just the first one', async () => {
    // Two independent unsupported constructs in two different rules -
    // both should be listed, since the validator is documented to collect
    // rather than fail-fast (so users get a full report in one pass).
    const fs = await import('node:fs/promises');
    const source = `
grammar TwoViolations
entry Model:
    'model' (a=ID & b=ID);
Other:
    'other' (c=ID & d=ID);
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
hidden terminal WS: /\\s+/;
`;
    const tmp = path.join(FIXTURES_DIR, '__generated-two-violations.langium');
    await fs.writeFile(tmp, source);
    try {
        const grammar = await loadGrammar(tmp);
        assert.throws(() => validateGrammar(grammar), (err) => {
            const violationCount = (err.message.match(/unsupported node type "UnorderedGroup"/g) ?? []).length;
            assert.equal(violationCount, 2);
            assert.match(err.message, /rule "Model"/);
            assert.match(err.message, /rule "Other"/);
            return true;
        });
    } finally {
        await fs.rm(tmp, { force: true });
    }
});

test('validateGrammar honours a custom allowedTypes override', async () => {
    const grammar = await loadGrammar(path.join(FIXTURES_DIR, 'unordered-group.langium'));

    const relaxed = new Set([...DEFAULT_ALLOWED_TYPES, 'UnorderedGroup']);
    assert.equal(validateGrammar(grammar, { allowedTypes: relaxed }), true);
});

test('validateGrammar skips terminal rules (only parser rules are walked)', async () => {
    // ID/INT/WS terminal rules use plain regex bodies, not the
    // Group/Alternatives/Assignment tree validateGrammar walks - make sure
    // they're never even inspected (isParserRule guards this).
    const grammar = await loadGrammar(inputPath('recipe.langium'));
    assert.equal(validateGrammar(grammar), true);
});
