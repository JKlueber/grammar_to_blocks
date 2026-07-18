import fs from 'node:fs/promises';

import { loadGrammar } from './grammar-loader.js';
import { validateGrammar } from './validator.js';
import { buildIR } from './ir-builder.js';
import { generateBlocksTs, generateGeneratorTs, generateMainTs } from './blockly-ts-target.js';

const filename = process.argv[2];

if (!filename) {
    console.error("Usage:");
    console.error("node parse.js robot.langium");
    process.exit(1);
}

// 1. Load + restrict: parse the .langium file and reject constructs
//    outside the currently supported subset.
const grammar = await loadGrammar(filename);
validateGrammar(grammar);

// 2. Grammar AST -> simple intermediate representation.
const ir = buildIR(grammar, {
    onWarning: (msg) => console.warn(`Warning: ${msg}`)
});

// 3. IR -> a drop-in blocks.ts / generator.ts / main.ts trio.
await fs.writeFile("blockly_app/src/blocks.ts", generateBlocksTs(ir));
await fs.writeFile("blockly_app/src/generator.ts", generateGeneratorTs(ir));
await fs.writeFile("blockly_app/src/main.ts", generateMainTs(ir));

console.log(`Generated ${ir.length} blocks -> blocks.ts, generator.ts, main.ts`);
