// Validates generate_blockly/src/ir-builder.js: the AST-to-IR mapping is
// where nearly every "what does this grammar feature mean as a Blockly
// input" decision lives (see its own doc comments), so this file checks
// each documented mapping directly against real parsed grammars rather
// than against hand-built fake AST nodes - that way a change to how
// Langium's own AST shapes things (e.g. a future Langium upgrade) would
// also be caught here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGrammar } from '../../generate_blockly/src/grammar-loader.js';
import {
    buildIR,
    findNameField,
    computeNameFields
} from '../../generate_blockly/src/ir-builder.js';
import { inputPath } from '../helpers/pipeline.js';

function partsOf(irRules, ruleName) {
    const rule = irRules.find(r => r.name === ruleName);
    assert.ok(rule, `expected an IR rule named "${ruleName}"`);
    return rule.parts;
}

test('feature=ID / feature=INT become "field" parts with the right fieldType', async () => {
    const grammar = await loadGrammar(inputPath('todo_list.langium'));
    const ir = buildIR(grammar);

    const [nameField] = partsOf(ir, 'Model').filter(p => p.kind === 'field');
    assert.deepEqual(nameField, { kind: 'field', feature: 'name', fieldType: 'text', optional: false, repeatable: false });

    const recipeIr = buildIR(await loadGrammar(inputPath('recipe.langium')));
    const amountField = partsOf(recipeIr, 'Ingredient').find(p => p.feature === 'amount');
    assert.equal(amountField.kind, 'field');
    assert.equal(amountField.fieldType, 'number');
});

test('feature=(a|b|c) of all keywords becomes a "dropdown" part with one option per keyword', async () => {
    const grammar = await loadGrammar(inputPath('todo_list.langium'));
    const ir = buildIR(grammar);
    const priority = partsOf(ir, 'Task').find(p => p.feature === 'priority');

    assert.equal(priority.kind, 'dropdown');
    assert.deepEqual(priority.options, [['low', 'low'], ['medium', 'medium'], ['high', 'high']]);
});

test('feature+=Rule becomes a "statement" part with refRuleName/refRuleNames set', async () => {
    const grammar = await loadGrammar(inputPath('todo_list.langium'));
    const ir = buildIR(grammar);
    const items = partsOf(ir, 'Model').find(p => p.kind === 'statement');

    assert.equal(items.feature, 'items');
    assert.equal(items.repeatable, true);
    assert.equal(items.refRuleName, 'Task');
    assert.deepEqual(items.refRuleNames, ['Task']);
});

test('feature=[Rule:TERMINAL] cross-reference becomes a "reference" part', async () => {
    const grammar = await loadGrammar(inputPath('recipe.langium'));
    const ir = buildIR(grammar);
    const ingredient = partsOf(ir, 'Step').find(p => p.kind === 'reference');

    assert.deepEqual(ingredient, {
        kind: 'reference',
        feature: 'ingredient',
        refRuleName: 'Ingredient',
        optional: false,
        repeatable: false
    });
});

test('a bare (unassigned) rule reference, e.g. task=Member?, becomes a "value" part', async () => {
    const grammar = await loadGrammar(inputPath('grammar.langium'));
    const ir = buildIR(grammar);
    const assignee = partsOf(ir, 'Task').find(p => p.feature === 'assignee');

    assert.equal(assignee.kind, 'value');
    assert.equal(assignee.refRuleName, 'Member');
    assert.equal(assignee.optional, true); // cardinality '?'
});

test('merged list-alternatives, (a+=A | b+=B)*, collapse into ONE shared "statement" part', async () => {
    const grammar = await loadGrammar(inputPath('adress_book.langium'));
    const ir = buildIR(grammar);
    const merged = partsOf(ir, 'Contact').find(p => p.kind === 'statement');

    // feature name is every branch's feature joined with "_", and every
    // rule that can fill the slot is listed in refRuleNames (see
    // ir-builder.js's Alternatives handler doc comment).
    assert.equal(merged.feature, 'phones_addresses');
    assert.deepEqual(merged.refRuleNames, ['Phone', 'Address']);
    assert.equal(merged.refRuleName, undefined); // more than one rule -> no single refRuleName
});

test('a bare all-keyword Alternatives (no feature=) becomes an anonymous dropdown', async () => {
    // Synthetic grammar: a top-level (‘a' | 'b') with no assignment.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { REPO_ROOT } = await import('../helpers/pipeline.js');
    const tmp = path.join(REPO_ROOT, 'tests', 'fixtures', '__generated-anon-dropdown.langium');
    await fs.writeFile(tmp, `
grammar AnonDropdown
entry Model:
    'model' name=ID ('a' | 'b');
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
hidden terminal WS: /\\s+/;
`);
    try {
        const grammar = await loadGrammar(tmp);
        const ir = buildIR(grammar);
        const dropdown = partsOf(ir, 'Model').find(p => p.kind === 'dropdown');

        assert.match(dropdown.feature, /^anon\d+$/);
        assert.deepEqual(dropdown.options, [['a', 'a'], ['b', 'b']]);
    } finally {
        await fs.rm(tmp, { force: true });
    }
});

test('mixed (non-keyword, non-uniform-list) Alternatives fall back to the first branch and emit a warning', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { REPO_ROOT } = await import('../helpers/pipeline.js');
    const tmp = path.join(REPO_ROOT, 'tests', 'fixtures', '__generated-mixed-alternatives.langium');
    await fs.writeFile(tmp, `
grammar MixedAlternatives
entry Model:
    'model' (name=ID | 'anonymous');
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
hidden terminal WS: /\\s+/;
`);
    try {
        const grammar = await loadGrammar(tmp);
        const warnings = [];
        const ir = buildIR(grammar, { onWarning: (msg) => warnings.push(msg) });

        // Falls back to the first branch (name=ID -> a "field" part),
        // preceded by the leading 'model' keyword part.
        const modelParts = partsOf(ir, 'Model');
        assert.deepEqual(modelParts.map(p => p.kind), ['keyword', 'field']);

        assert.ok(warnings.some(w => w.includes('only partially supported')));
    } finally {
        await fs.rm(tmp, { force: true });
    }
});

test('findNameField / computeNameFields identify the first text field per rule, or none', async () => {
    const grammar = await loadGrammar(inputPath('adress_book.langium'));
    const ir = buildIR(grammar);

    assert.equal(findNameField(ir.find(r => r.name === 'Contact')), 'name');
    assert.equal(findNameField(ir.find(r => r.name === 'Address')), 'city');
    // Phone only has a numeric field ("number") - nothing to use as a name.
    assert.equal(findNameField(ir.find(r => r.name === 'Phone')), undefined);

    const nameFields = computeNameFields(ir);
    assert.deepEqual([...nameFields.entries()].sort(), [['address', 'city'], ['contact', 'name']]);
    assert.equal(nameFields.has('phone'), false);
});

test('entry rule is flagged with entry: true, non-entry rules with entry: false', async () => {
    const grammar = await loadGrammar(inputPath('todo_list.langium'));
    const ir = buildIR(grammar);

    assert.equal(ir.find(r => r.name === 'Model').entry, true);
    assert.equal(ir.find(r => r.name === 'Task').entry, false);
});
