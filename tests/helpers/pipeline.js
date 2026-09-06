// Thin wrapper around the four pipeline stages (load -> validate -> build IR
// -> generate) that the CLI (generate_blockly/src/parse.js) also runs, but
// returns everything as in-memory strings/objects instead of writing to
// blockly_app/src/*.ts. Tests use this so they never touch - or depend on
// the state of - the real generated output files.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGrammar } from '../../generate_blockly/src/grammar-loader.js';
import { validateGrammar } from '../../generate_blockly/src/validator.js';
import { buildIR } from '../../generate_blockly/src/ir-builder.js';
import {
    generateBlocksTs,
    generateGeneratorTs,
    generateMainTs
} from '../../generate_blockly/src/blockly-ts-target.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const INPUT_DIR = path.join(REPO_ROOT, 'generate_blockly', 'input');

/** Resolve one of the bundled example grammars by filename. */
export function inputPath(filename) {
    return path.join(INPUT_DIR, filename);
}

/**
 * Runs stage 1+2 only (load + validate), the "is this grammar within the
 * supported subset at all" check. Rejects/throws exactly like the real CLI
 * does on an unsupported grammar.
 */
export async function loadAndValidate(filename) {
    const grammar = await loadGrammar(filename);
    validateGrammar(grammar);
    return grammar;
}

/**
 * Runs the full pipeline (all 4 stages) and returns the intermediate
 * representation plus every generated file's *source text*, without
 * writing anything to disk. This is what most validation/evaluation tests
 * build on top of.
 */
export async function runPipeline(filename, { onWarning } = {}) {
    const grammar = await loadAndValidate(filename);
    const ir = buildIR(grammar, { onWarning });

    return {
        grammar,
        ir,
        blocksTs: generateBlocksTs(ir),
        generatorTs: generateGeneratorTs(ir),
        mainTs: generateMainTs(ir)
    };
}
