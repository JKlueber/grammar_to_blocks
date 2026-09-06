#!/usr/bin/env node
// EVALUATION (performance): "what is the performance cost?" - answered by
// timing each of the four pipeline stages (load / validate / buildIR /
// generate) independently, both for the bundled example grammars and for
// synthetic grammars of increasing size (see synthetic-grammar.js), so we
// can see not just "how fast is it today" but "how does it scale".
//
// This is a plain script, not a node:test file - performance numbers are
// informative, not pass/fail, and printing a readable report is the point
// (there's no single "correct" duration to assert against, only trends
// and orders of magnitude worth keeping an eye on).
//
// Run with: npm run test:perf
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { loadGrammar } from '../../generate_blockly/src/grammar-loader.js';
import { validateGrammar } from '../../generate_blockly/src/validator.js';
import { buildIR } from '../../generate_blockly/src/ir-builder.js';
import { generateBlocksTs, generateGeneratorTs, generateMainTs } from '../../generate_blockly/src/blockly-ts-target.js';
import { inputPath, REPO_ROOT } from '../helpers/pipeline.js';
import { generateSyntheticGrammar } from './synthetic-grammar.js';

const SCRATCH_DIR = path.join(REPO_ROOT, 'tests', 'evaluation', 'generated');
const REPEATS = 7;
const WARMUP = 2;

/** Runs `fn` (WARMUP + REPEATS) times and returns min/median/mean/max in ms. */
async function time(fn, { repeats = REPEATS, warmup = WARMUP } = {}) {
    for (let i = 0; i < warmup; i++) await fn();

    const samples = [];
    for (let i = 0; i < repeats; i++) {
        const t0 = performance.now();
        await fn();
        samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);

    return {
        min: samples[0],
        median: samples[Math.floor(samples.length / 2)],
        mean: samples.reduce((a, b) => a + b, 0) / samples.length,
        max: samples[samples.length - 1]
    };
}

function fmt(ms) {
    return `${ms.toFixed(2)}ms`;
}

/** Times each of the 4 pipeline stages for one grammar file, reusing the loaded grammar/IR across repeats of the later stages (they're pure/non-mutating). */
async function benchmarkFile(filePath) {
    const loadStats = await time(() => loadGrammar(filePath));

    const grammar = await loadGrammar(filePath);
    const validateStats = await time(() => validateGrammar(grammar));

    const buildIRStats = await time(() => buildIR(grammar));
    const ir = buildIR(grammar);

    const generateStats = await time(() => {
        generateBlocksTs(ir);
        generateGeneratorTs(ir);
        generateMainTs(ir);
    });

    return {
        ruleCount: ir.length,
        stages: { load: loadStats, validate: validateStats, buildIR: buildIRStats, generate: generateStats }
    };
}

function printStageTable(title, rowsByLabel) {
    console.log(`\n${title}`);
    console.table(
        Object.fromEntries(
            Object.entries(rowsByLabel).map(([label, result]) => [
                label,
                {
                    'rules': result.ruleCount,
                    'load (median)': fmt(result.stages.load.median),
                    'validate (median)': fmt(result.stages.validate.median),
                    'buildIR (median)': fmt(result.stages.buildIR.median),
                    'generate (median)': fmt(result.stages.generate.median),
                    'total (median)': fmt(
                        result.stages.load.median +
                        result.stages.validate.median +
                        result.stages.buildIR.median +
                        result.stages.generate.median
                    )
                }
            ])
        )
    );
}

async function benchmarkBundledExamples() {
    const files = [
        'todo_list.langium',
        'state_machine.langium',
        'recipe.langium',
        'adress_book.langium',
        'grammar.langium',
        'invalid.langium'
    ];

    const results = {};
    for (const filename of files) {
        results[filename] = await benchmarkFile(inputPath(filename));
    }

    printStageTable('Bundled example grammars (7 reps, 2 warmup, times in ms):', results);
    return results;
}

async function benchmarkSyntheticScaling() {
    await fs.mkdir(SCRATCH_DIR, { recursive: true });

    const sizes = [1, 5, 10, 25, 50, 100, 200];
    const results = {};

    for (const size of sizes) {
        const filePath = path.join(SCRATCH_DIR, `synthetic-${size}.langium`);
        await fs.writeFile(filePath, generateSyntheticGrammar(size));
        results[`${size} rules`] = await benchmarkFile(filePath);
    }

    printStageTable('Synthetic grammars of increasing size (7 reps, 2 warmup, times in ms):', results);

    // A quick, explicit scaling readout: buildIR/generate should grow
    // roughly linearly with rule count (they're simple per-rule loops);
    // `load` is dominated by Langium re-creating its grammar services on
    // every call (see the comment in grammar-loader.js) and is expected
    // to scale worse / more unpredictably as a result - this is called
    // out explicitly rather than left to be inferred from the table.
    const smallest = results['1 rules'];
    const largest = results['200 rules'];
    const ratio = (stage) => (largest.stages[stage].median / smallest.stages[stage].median).toFixed(1);

    console.log('\nScaling from 1 -> 200 rules (median time ratio, ideal linear = ~200x):');
    console.log(`  load:      ${ratio('load')}x`);
    console.log(`  validate:  ${ratio('validate')}x`);
    console.log(`  buildIR:   ${ratio('buildIR')}x`);
    console.log(`  generate:  ${ratio('generate')}x`);
    console.log(
        '\nNote: loadGrammar() calls createLangiumGrammarServices() fresh on every\n' +
        'invocation (see generate_blockly/src/grammar-loader.js) - that setup cost\n' +
        'is paid once per CLI run today, which is fine for the one-shot `node\n' +
        'generate_blockly/src/parse.js <file>` usage pattern, but would be worth\n' +
        'caching/reusing the services object if this pipeline is ever driven in a\n' +
        'long-running process (e.g. a watch mode or a server) that converts many\n' +
        'grammars per process lifetime.'
    );

    await fs.rm(SCRATCH_DIR, { recursive: true, force: true });
    return results;
}

async function main() {
    console.log('Performance evaluation: generate_blockly pipeline\n' + '='.repeat(50));
    await benchmarkBundledExamples();
    await benchmarkSyntheticScaling();
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
