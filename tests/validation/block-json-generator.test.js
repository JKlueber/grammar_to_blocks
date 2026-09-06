// Validates generate_blockly/src/block-json-generator.js - the standalone
// RuleIR[] -> plain Blockly JSON generator (not used by the CLI directly,
// but its `argBuilders` registry IS reused by blockly-ts-target.js, so
// bugs here would silently propagate into the real generated output too).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGrammar } from '../../generate_blockly/src/grammar-loader.js';
import { buildIR } from '../../generate_blockly/src/ir-builder.js';
import { generateBlockJson, argBuilders } from '../../generate_blockly/src/block-json-generator.js';
import { inputPath } from '../helpers/pipeline.js';

function blockOf(blocks, type) {
    const block = blocks.find(b => b.type === type);
    assert.ok(block, `expected a generated block of type "${type}"`);
    return block;
}

test('generateBlockJson lowercases rule names as block types', async () => {
    const ir = buildIR(await loadGrammar(inputPath('todo_list.langium')));
    const blocks = generateBlockJson(ir);

    assert.deepEqual(blocks.map(b => b.type).sort(), ['model', 'task']);
});

test('keyword parts are concatenated into message0, one %N placeholder per non-keyword part', async () => {
    const ir = buildIR(await loadGrammar(inputPath('todo_list.langium')));
    const blocks = generateBlockJson(ir);
    const task = blockOf(blocks, 'task');

    // task: 'task' name=ID priority=(...) done=(...)  -> 1 keyword + 3 args
    assert.equal(task.message0, 'task %1 %2 %3');
    assert.equal(task.args0.length, 3);
});

test('field/dropdown/statement IR parts map to the expected Blockly arg types', async () => {
    const ir = buildIR(await loadGrammar(inputPath('todo_list.langium')));
    const blocks = generateBlockJson(ir);

    const task = blockOf(blocks, 'task');
    assert.equal(task.args0[0].type, 'field_input'); // name (ID)
    assert.equal(task.args0[1].type, 'field_dropdown'); // priority
    assert.equal(task.args0[2].type, 'field_dropdown'); // done

    const model = blockOf(blocks, 'model');
    const statementArg = model.args0.find(a => a.type === 'input_statement');
    assert.equal(statementArg.name, 'items');
});

test('INT-typed fields map to field_number, not field_input', async () => {
    const ir = buildIR(await loadGrammar(inputPath('recipe.langium')));
    const blocks = generateBlockJson(ir);
    const ingredient = blockOf(blocks, 'ingredient');

    const amountArg = ingredient.args0.find(a => a.name === 'amount');
    assert.equal(amountArg.type, 'field_number');
    assert.equal(amountArg.value, 0);
});

test('a cross-reference to a rule WITH a name field becomes a field_reference', async () => {
    const ir = buildIR(await loadGrammar(inputPath('recipe.langium')));
    const blocks = generateBlockJson(ir);
    const step = blockOf(blocks, 'step');

    const ingredientArg = step.args0.find(a => a.name === 'ingredient');
    assert.deepEqual(ingredientArg, {
        type: 'field_reference',
        name: 'ingredient',
        referencesType: 'ingredient',
        nameField: 'name'
    });
});

test('a cross-reference to a rule WITHOUT a name field falls back to field_input', () => {
    // Directly exercise argBuilders.reference (rather than round-tripping
    // through a grammar) for the documented fallback path: the target
    // rule has no findNameField() result, so there's nothing to build a
    // live dropdown from.
    const part = { kind: 'reference', feature: 'owner', refRuleName: 'Numeric' };
    const nameFields = new Map(); // 'numeric' intentionally absent

    const arg = argBuilders.reference(part, nameFields);
    assert.deepEqual(arg, { type: 'field_input', name: 'owner', text: '' });
});

test('every generated block has previousStatement/nextStatement: null (this generator predates stacking "check" types)', async () => {
    const ir = buildIR(await loadGrammar(inputPath('todo_list.langium')));
    const blocks = generateBlockJson(ir);

    for (const block of blocks) {
        assert.equal(block.previousStatement, null);
        assert.equal(block.nextStatement, null);
    }
});
