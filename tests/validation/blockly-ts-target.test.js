// Validates generate_blockly/src/blockly-ts-target.js - the module the CLI
// (parse.js) actually calls. Focuses on the parts of its logic that aren't
// exercised by block-json-generator.test.js: computeStackTypes (merged
// "check" types for repeated rules), computeValueRules (telling a real
// value/output block apart from a plain +=-repeated one), and the
// generator.ts function bodies it emits.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGrammar } from '../../generate_blockly/src/grammar-loader.js';
import { buildIR } from '../../generate_blockly/src/ir-builder.js';
import { generateBlocksTs, generateGeneratorTs, generateMainTs } from '../../generate_blockly/src/blockly-ts-target.js';
import { inputPath } from '../helpers/pipeline.js';

async function irFor(filename) {
    return buildIR(await loadGrammar(inputPath(filename)));
}

function parseBlocksJson(blocksTs) {
    // Pull the JSON array literal out of the generated source rather than
    // executing it, so this test stays a pure string/structure check (the
    // full-execution round trip lives in roundtrip.test.js).
    const match = blocksTs.match(/defineBlocksWithJsonArray\(\s*([\s\S]*?)\s*\);/);
    assert.ok(match, 'expected a defineBlocksWithJsonArray(...) call in generated blocks.ts');
    return JSON.parse(match[1]);
}

test('generateBlocksTs imports the reference-field module for its registration side effect', async () => {
    const blocksTs = generateBlocksTs(await irFor('todo_list.langium'));
    assert.match(blocksTs, /import '\.\/reference-field';/);
});

test('merged alternatives get a shared "_or_" check type on every participating rule', async () => {
    const blocks = parseBlocksJson(generateBlocksTs(await irFor('adress_book.langium')));
    const phone = blocks.find(b => b.type === 'phone');
    const address = blocks.find(b => b.type === 'address');
    const contact = blocks.find(b => b.type === 'contact');

    assert.equal(phone.previousStatement, 'address_or_phone');
    assert.equal(address.previousStatement, 'address_or_phone');

    const statementArg = contact.args2[0];
    assert.equal(statementArg.type, 'input_statement');
    assert.equal(statementArg.check, 'address_or_phone');
});

test('a rule referenced only via a single-rule +=, e.g. items+=Task*, reduces to its own lowercase check type', async () => {
    const blocks = parseBlocksJson(generateBlocksTs(await irFor('todo_list.langium')));
    const task = blocks.find(b => b.type === 'task');

    assert.equal(task.previousStatement, 'task');
    assert.equal(task.nextStatement, 'task');
});

test('a rule that is never +=-repeated anywhere, but IS referenced via plain feature=Rule, becomes a value/output block', async () => {
    // Metadata (grammar.langium / ProjectDSL) is only ever used as
    // `metadata=Metadata?` - never `+=Metadata` - so it's a genuine
    // "plug-in value" block, not a stackable statement block.
    const blocks = parseBlocksJson(generateBlocksTs(await irFor('grammar.langium')));
    const metadata = blocks.find(b => b.type === 'metadata');
    const project = blocks.find(b => b.type === 'project');

    assert.equal(metadata.output, 'metadata');
    assert.equal(metadata.previousStatement, undefined);

    const metadataArg = project.args2.find(a => a.name === 'METADATA');
    assert.equal(metadataArg.type, 'input_value');
    assert.equal(metadataArg.check, 'metadata');
});

test('a plain feature=Rule reference to a rule that IS separately +=-repeated falls back to a plain text field (no real value block exists for it)', async () => {
    // Task.assignee = Member, but Member is *also* used via
    // `members+=Member*` - so Member is a stackable statement type, not a
    // value/output block, and there is nothing for `assignee` to plug
    // into. partToArg documents this fallback explicitly.
    const blocks = parseBlocksJson(generateBlocksTs(await irFor('grammar.langium')));
    const task = blocks.find(b => b.type === 'task');

    const assigneeArg = task.args0.find(a => a.name === 'ASSIGNEE');
    assert.equal(assigneeArg.type, 'field_input');
    assert.equal(assigneeArg.text, 'default_assignee');
});

test('feature names are upper-snake-cased for arg names (unlike block-json-generator.js, which keeps them raw)', async () => {
    const blocks = parseBlocksJson(generateBlocksTs(await irFor('recipe.langium')));
    const ingredient = blocks.find(b => b.type === 'ingredient');

    assert.deepEqual(ingredient.args0.map(a => a.name), ['NAME', 'AMOUNT']);
});

test('a resolved field_reference arg has its nameField upper-snake-cased to match the target block\'s own arg name', async () => {
    const blocks = parseBlocksJson(generateBlocksTs(await irFor('recipe.langium')));
    const step = blocks.find(b => b.type === 'step');

    const ingredientArg = step.args0.find(a => a.type === 'field_reference');
    assert.equal(ingredientArg.referencesType, 'ingredient');
    assert.equal(ingredientArg.nameField, 'NAME'); // not the raw feature "name"
});

test('generateGeneratorTs emits a forBlock function per rule, returning [code, ORDER_ATOMIC] for value blocks and a plain string otherwise', async () => {
    const generatorTs = generateGeneratorTs(await irFor('grammar.langium'));

    assert.match(generatorTs, /generator\.forBlock\['metadata'\] = function \(block: Blockly\.Block\) \{/);
    assert.match(generatorTs, /return \[code, generator\.ORDER_ATOMIC\];/);

    assert.match(generatorTs, /generator\.forBlock\['project'\] = function \(block: Blockly\.Block\): string \{/);
    assert.match(generatorTs, /return code;\s*\n};/); // project is the entry rule: never itself stacked, no trailing '\n'
});

test('generateGeneratorTs appends a trailing newline for every stackable (repeated) rule\'s output', async () => {
    const generatorTs = generateGeneratorTs(await irFor('todo_list.langium'));
    const taskFn = generatorTs.match(/generator\.forBlock\['task'\][\s\S]*?\};/)[0];

    assert.match(taskFn, /return code \+ '\\n';/);
});

test('generateMainTs splits entry vs. non-entry rules into separate toolbox categories', async () => {
    const mainTs = generateMainTs(await irFor('todo_list.langium'));
    const toolboxMatch = mainTs.match(/toolbox: (\{[\s\S]*?\})\s*\}\);/);
    assert.ok(toolboxMatch);
    const toolbox = JSON.parse(toolboxMatch[1]);

    const categoryNames = toolbox.contents.map(c => c.name);
    assert.deepEqual(categoryNames, ['Main / Entry', 'Elements & Components']);

    const entryCategory = toolbox.contents.find(c => c.name === 'Main / Entry');
    assert.deepEqual(entryCategory.contents.map(b => b.type), ['model']);
});

test('colour is a deterministic hash of the rule name (stable across repeated generation)', async () => {
    const ir = await irFor('todo_list.langium');
    const first = parseBlocksJson(generateBlocksTs(ir));
    const second = parseBlocksJson(generateBlocksTs(ir));

    assert.deepEqual(first.map(b => b.colour), second.map(b => b.colour));
    for (const block of first) {
        assert.ok(block.colour >= 0 && block.colour < 360, `colour ${block.colour} out of hue range`);
    }
});
