// EVALUATION (not validation): this file doesn't just check "is a single
// known output correct" (that's what tests/validation/* does) - it checks
// breadth: does the pipeline succeed for every bundled example grammar,
// does it exercise every documented IR part kind at least once somewhere,
// and does every grammar that's supposed to fail actually fail at the
// stage the README/docs say it should (load vs. validate)?
//
// Prints a small coverage table as a side effect so `npm run test:eval`
// doubles as a human-readable coverage report, not just a pass/fail count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { loadGrammar } from '../../generate_blockly/src/grammar-loader.js';
import { validateGrammar } from '../../generate_blockly/src/validator.js';
import { buildIR } from '../../generate_blockly/src/ir-builder.js';
import { generateBlocksTs, generateGeneratorTs, generateMainTs } from '../../generate_blockly/src/blockly-ts-target.js';
import { inputPath, REPO_ROOT } from '../helpers/pipeline.js';

const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures');

// Every grammar this repo ships or that this suite adds as a fixture,
// with the outcome the pipeline is *expected* to produce. Add a row here
// whenever a new example grammar is added to generate_blockly/input/ or a
// new fixture is added to tests/fixtures/ - that's the whole point of a
// coverage test: an unlisted grammar is a coverage gap, not a free pass.
const CASES = [
    { file: inputPath('todo_list.langium'), expect: 'pipeline-succeeds' },
    { file: inputPath('state_machine.langium'), expect: 'pipeline-succeeds' },
    { file: inputPath('recipe.langium'), expect: 'pipeline-succeeds' },
    { file: inputPath('adress_book.langium'), expect: 'pipeline-succeeds' },
    { file: inputPath('grammar.langium'), expect: 'pipeline-succeeds' },
    { file: inputPath('invalid.langium'), expect: 'pipeline-succeeds' }, // uses CrossReference - supported
    { file: path.join(FIXTURES_DIR, 'syntax-error.langium'), expect: 'fails-at-load' },
    { file: path.join(FIXTURES_DIR, 'unordered-group.langium'), expect: 'fails-at-validate' }
];

/** Runs the pipeline against one grammar file, capturing which stage (if any) it failed at. */
async function classify(file) {
    let grammar;
    try {
        grammar = await loadGrammar(file);
    } catch (e) {
        return { outcome: 'fails-at-load', error: e.message.split('\n')[0] };
    }

    try {
        validateGrammar(grammar);
    } catch (e) {
        return { outcome: 'fails-at-validate', error: e.message.split('\n')[0] };
    }

    const ir = buildIR(grammar);
    // Generation itself should never throw for anything that passed
    // validation - if it does, that's a gap between what the validator
    // allows and what the code generators actually implement.
    generateBlocksTs(ir);
    generateGeneratorTs(ir);
    generateMainTs(ir);

    return { outcome: 'pipeline-succeeds', ir };
}

test('coverage: every bundled/fixture grammar produces the expected outcome', async (t) => {
    const rows = [];

    for (const { file, expect } of CASES) {
        await t.test(path.basename(file), async () => {
            const result = await classify(file);
            rows.push({ grammar: path.basename(file), expected: expect, actual: result.outcome, note: result.error ?? '' });
            assert.equal(result.outcome, expect, `${path.basename(file)}: expected ${expect}, got ${result.outcome}`);
        });
    }

    t.after(() => {
        console.log('\nCoverage summary (generate_blockly pipeline):');
        console.table(rows.map(({ grammar, expected, actual, note }) => ({ grammar, expected, actual, note })));
    });
});

test('coverage: every documented IR part kind is exercised by at least one bundled grammar', async () => {
    // ir-builder.js documents 6 possible IRPart kinds. If a future change
    // to the bundled example grammars stopped exercising one of them,
    // every other test could still pass while a whole code path silently
    // stops being covered - this test exists specifically to catch that.
    const ALL_KINDS = ['keyword', 'field', 'dropdown', 'value', 'statement', 'reference'];
    const seenKinds = new Set();

    for (const { file, expect } of CASES) {
        if (expect !== 'pipeline-succeeds')
            continue;

        const grammar = await loadGrammar(file);
        const ir = buildIR(grammar);
        for (const rule of ir)
            for (const part of rule.parts)
                seenKinds.add(part.kind);
    }

    const missing = ALL_KINDS.filter(k => !seenKinds.has(k));
    assert.deepEqual(missing, [], `IR part kind(s) not exercised by any bundled grammar: ${missing.join(', ')}`);
});

test('coverage: every documented validator-rejected construct actually gets rejected', async () => {
    // DEFAULT_ALLOWED_TYPES documents Grammar/ParserRule/Group/Alternatives/
    // Assignment/Keyword/RuleCall/CrossReference as supported. The one
    // construct explicitly called out in ast-utils.js/validator.js as
    // "not yet supported" is UnorderedGroup - confirm it's still rejected
    // (this is the negative-space counterpart to the IR-kind check above).
    const grammar = await loadGrammar(path.join(FIXTURES_DIR, 'unordered-group.langium'));
    assert.throws(() => validateGrammar(grammar), /UnorderedGroup/);
});
