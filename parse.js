import fs from 'node:fs/promises';

import { loadGrammar } from './grammar-loader.js';
import { generateBlocks } from './block-generator.js';

const filename = process.argv[2];

if (!filename) {
    console.error("Usage:");
    console.error("node parse.js robot.langium");
    process.exit(1);
}

const grammar = await loadGrammar(filename);

const blocks = generateBlocks(grammar);

await fs.writeFile(
    "blocks.json",
    JSON.stringify(blocks, null, 2)
);

console.log(`Generated ${blocks.length} blocks.`);