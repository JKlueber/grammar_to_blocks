// The deepest validation test in this suite: rather than inspecting IR or
// generated *source text*, this actually COMPILES the generated
// blocks.ts/generator.ts to JS, loads them as real modules backed by the
// real 'blockly' npm package, builds a real (headless) Blockly.Workspace,
// wires up blocks the way a person would by dragging them in the UI, and
// checks that Blockly's own generator reconstructs the expected DSL text.
//
// This is possible without a browser because Blockly's *model* (Workspace,
// Block, connections, fields) has no DOM dependency - only the SVG
// *renderer* (WorkspaceSvg / Blockly.inject, used by blockly_app/src/main.ts)
// does. See tests/helpers/ts-eval.js for how the compile+load step works.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runPipeline } from '../helpers/pipeline.js';
import { loadGeneratedModules, freshWorkspace } from '../helpers/ts-eval.js';
import { inputPath } from '../helpers/pipeline.js';

test('round trip: todo_list.langium reconstructs a multi-task todo list', async () => {
    const { blocksTs, generatorTs } = await runPipeline(inputPath('todo_list.langium'));
    const { defineBlocks, generator, cleanup } = await loadGeneratedModules({ blocksTs, generatorTs });

    try {
        const { workspace } = await freshWorkspace();
        defineBlocks();

        const model = workspace.newBlock('model');
        model.setFieldValue('chores', 'NAME');

        const task1 = workspace.newBlock('task');
        task1.setFieldValue('dishes', 'NAME');
        task1.setFieldValue('high', 'PRIORITY');
        task1.setFieldValue('no', 'DONE');

        const task2 = workspace.newBlock('task');
        task2.setFieldValue('laundry', 'NAME');
        task2.setFieldValue('low', 'PRIORITY');
        task2.setFieldValue('yes', 'DONE');

        model.getInput('ITEMS').connection.connect(task1.previousConnection);
        task1.nextConnection.connect(task2.previousConnection);

        const code = generator.workspaceToCode(workspace);

        assert.equal(code, [
            'todo chores {',
            '  task dishes high no',
            '  task laundry low yes',
            '}'
        ].join('\n'));
    } finally {
        await cleanup();
    }
});

test('round trip: an empty statement input produces valid (if empty) output rather than throwing', async () => {
    const { blocksTs, generatorTs } = await runPipeline(inputPath('todo_list.langium'));
    const { defineBlocks, generator, cleanup } = await loadGeneratedModules({ blocksTs, generatorTs });

    try {
        const { workspace } = await freshWorkspace();
        defineBlocks();

        const model = workspace.newBlock('model');
        model.setFieldValue('empty_list', 'NAME');
        // No task blocks connected at all.

        const code = generator.workspaceToCode(workspace);
        assert.equal(code, 'todo empty_list {\n\n}');
    } finally {
        await cleanup();
    }
});

test('round trip: adress_book.langium reconstructs interleaved phone/address entries in stacking order', async () => {
    const { blocksTs, generatorTs } = await runPipeline(inputPath('adress_book.langium'));
    const { defineBlocks, generator, cleanup } = await loadGeneratedModules({ blocksTs, generatorTs });

    try {
        const { workspace } = await freshWorkspace();
        defineBlocks();

        const book = workspace.newBlock('addressbook');

        const contact = workspace.newBlock('contact');
        contact.setFieldValue('ada', 'NAME');

        const phone = workspace.newBlock('phone');
        phone.setFieldValue(12345, 'NUMBER');

        const address = workspace.newBlock('address');
        address.setFieldValue('london', 'CITY');

        // Interleave phone then address in the SAME shared statement input
        // (this is exactly the "merged alternatives" feature under test -
        // Phone and Address instances must be able to stack together).
        contact.getInput('PHONES_ADDRESSES').connection.connect(phone.previousConnection);
        phone.nextConnection.connect(address.previousConnection);

        book.getInput('CONTACTS').connection.connect(contact.previousConnection);

        const code = generator.workspaceToCode(workspace);

        // Indentation compounds: Contact's own generator indents its
        // phones_addresses statement input by one level (2 spaces), and
        // AddressBook's generator indents Contact's whole (already
        // indented) block by another level - hence 4 spaces for the
        // innermost lines and 2 for Contact's own closing "}".
        assert.equal(code, [
            'contact ada {',
            '    phone 12345',
            '    address london',
            '  }'
        ].join('\n'));
    } finally {
        await cleanup();
    }
});

test('round trip: recipe.langium\'s cross-reference field reads back the picked ingredient name verbatim', async () => {
    const { blocksTs, generatorTs } = await runPipeline(inputPath('recipe.langium'));
    const { defineBlocks, generator, cleanup } = await loadGeneratedModules({ blocksTs, generatorTs });

    try {
        const { workspace } = await freshWorkspace();
        defineBlocks();

        const cookbook = workspace.newBlock('cookbook');
        cookbook.setFieldValue('pancakes', 'NAME');

        const flour = workspace.newBlock('ingredient');
        flour.setFieldValue('flour', 'NAME');
        flour.setFieldValue(200, 'AMOUNT');

        const step = workspace.newBlock('step');
        step.setFieldValue(1, 'NUMBER');
        step.setFieldValue('mix', 'ACTION');
        // The cross-reference field is a live-scanned dropdown over every
        // declared 'ingredient' block's NAME - here we simulate "picking"
        // flour the same way a user selecting it in the UI would: setting
        // the field's stored value to that name.
        step.setFieldValue('flour', 'INGREDIENT');

        cookbook.getInput('INGREDIENTS').connection.connect(flour.previousConnection);
        cookbook.getInput('STEPS').connection.connect(step.previousConnection);

        const code = generator.workspaceToCode(workspace);

        assert.equal(code, [
            'recipe pancakes {',
            '  ingredient flour 200',
            '  step 1 mix flour',
            '}'
        ].join('\n'));
    } finally {
        await cleanup();
    }
});

test('round trip: grammar.langium\'s Metadata plugs into Project as a real value/output block', async () => {
    const { blocksTs, generatorTs } = await runPipeline(inputPath('grammar.langium'));
    const { defineBlocks, generator, cleanup } = await loadGeneratedModules({ blocksTs, generatorTs });

    try {
        const { workspace } = await freshWorkspace();
        defineBlocks();

        const project = workspace.newBlock('project');
        project.setFieldValue('demo', 'NAME');

        const metadata = workspace.newBlock('metadata');
        metadata.setFieldValue(1, 'VERSION');
        metadata.setFieldValue('public', 'VISIBILITY');

        project.getInput('METADATA').connection.connect(metadata.outputConnection);

        const code = generator.workspaceToCode(workspace);

        assert.equal(code, [
            'project demo {',
            '  metadata { 1 public }',
            '',
            '',
            '',
            '}'
        ].join('\n'));
    } finally {
        await cleanup();
    }
});