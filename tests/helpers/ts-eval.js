// Loads the *actual* generated blocks.ts / generator.ts source (as produced
// by blockly-ts-target.js) as real, running ES modules, backed by the real
// 'blockly' npm package. This lets tests exercise the generated code
// end-to-end - defining blocks, building a headless Blockly.Workspace,
// wiring blocks together, and running the real forBlock generator
// functions - without a browser or any mocking of Blockly itself.
//
// Blockly's *model* (Blockly.Workspace, Block, connections, fields) works
// fine in plain Node - it's only the SVG *renderer* (Blockly.WorkspaceSvg /
// Blockly.inject) that needs a DOM. Since blocks.ts / generator.ts never
// touch the renderer, we can run them completely headless.
import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

import { REPO_ROOT } from './pipeline.js';

const BLOCKLY_APP_SRC = path.join(REPO_ROOT, 'blockly_app', 'src');

function compileToEsm(tsSource) {
    return ts.transpileModule(tsSource, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022
        }
    }).outputText;
}

// reference-field.ts is static hand-written infra (see its own doc
// comment / README's "How cross-references work" section) - it never
// changes per-grammar, so it's compiled once to a fixed, gitignored
// filename and reused by every test in this run, rather than once per
// grammar or per test file. (Each `node --test <file>` may run in its own
// process, so a purely in-memory cache wouldn't be shared across files -
// a fixed-path file is what actually avoids recompiling redundantly, and
// overwriting it with identical content on a second process is harmless.)
const REFERENCE_FIELD_COMPILED = path.join(BLOCKLY_APP_SRC, '__test-reference-field.generated.mjs');
let referenceFieldReady;
async function compiledReferenceFieldUrl() {
    if (!referenceFieldReady) {
        referenceFieldReady = fs.readFile(path.join(BLOCKLY_APP_SRC, 'reference-field.ts'), 'utf8')
            .then(src => fs.writeFile(REFERENCE_FIELD_COMPILED, compileToEsm(src)));
    }
    await referenceFieldReady;
    return pathToFileURL(REFERENCE_FIELD_COMPILED).href;
}

/**
 * Compiles the given generated `blocksTs` / `generatorTs` source strings
 * and imports them as real modules.
 *
 * Returns `{ defineBlocks, generator, cleanup }` - call `cleanup()` when
 * done so the temporary compiled files don't linger in blockly_app/src.
 *
 * NOTE: the temp files are written into blockly_app/src (not os.tmpdir())
 * because the generated blocks.ts has a relative import,
 * `import './reference-field'` - Node's ESM resolver needs the compiled
 * file to sit next to a compiled reference-field.mjs for that to resolve.
 */
export async function loadGeneratedModules({ blocksTs, generatorTs }) {
    const refUrl = await compiledReferenceFieldUrl();
    const refFileName = path.basename(new URL(refUrl).pathname);

    const uid = randomUUID();
    const blocksPath = path.join(BLOCKLY_APP_SRC, `__test-blocks.${uid}.mjs`);
    const generatorPath = path.join(BLOCKLY_APP_SRC, `__test-generator.${uid}.mjs`);

    const blocksJs = compileToEsm(blocksTs)
        .replace("import './reference-field';", `import './${refFileName}';`);
    const generatorJs = compileToEsm(generatorTs);

    await fs.writeFile(blocksPath, blocksJs);
    await fs.writeFile(generatorPath, generatorJs);

    const [{ defineBlocks }, { generator }] = await Promise.all([
        import(pathToFileURL(blocksPath).href),
        import(pathToFileURL(generatorPath).href)
    ]);

    return {
        defineBlocks,
        generator,
        cleanup: () => Promise.all([
            fs.rm(blocksPath, { force: true }),
            fs.rm(generatorPath, { force: true })
        ])
    };
}

/** Fresh, isolated Blockly (module) + a new headless Workspace. */
export async function freshWorkspace() {
    const Blockly = await import('blockly');
    return { Blockly, workspace: new Blockly.Workspace() };
}
