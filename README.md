# langium-to-blockly

Turns a [Langium](https://langium.org/) grammar (`.langium` file) into a working
[Blockly](https://developers.google.com/blockly) block editor: block definitions,
a code generator that turns the workspace back into concrete DSL text, and a
minimal Vite/TypeScript app that wires them into a browser UI with a live
"code output" panel.

The pipeline only understands a **restricted subset** of Langium grammars
(see [Supported grammar subset](#supported-grammar-subset-and-limitations)
below). Point it at a grammar file, it validates the grammar against that
subset, converts it to a small intermediate representation (IR), and emits
three TypeScript files that plug directly into `blockly_app/`.

```
.langium grammar
      │
      ▼
 grammar-loader.js   (parse with Langium's own grammar services)
      │
      ▼
 validator.js         (reject anything outside the supported subset)
      │
      ▼
 ir-builder.js         (AST -> RuleIR[])
      │
      ▼
 blockly-ts-target.js  (RuleIR[] -> blocks.ts / generator.ts / main.ts)
      │
      ▼
 blockly_app/src/*.ts  (consumed by the Vite app in the browser)
```

---

## Quick start

```bash
npm install

# Generate blocks.ts / generator.ts / main.ts from a grammar
node generate_blockly/src/parse.js generate_blockly/input/grammar.langium

# Launch the Blockly editor for the grammar you just generated
npm run dev
```

Open the printed local URL; you'll see a Blockly workspace pre-loaded with a
toolbox containing one block per parser rule in the grammar, plus a live
"code output" panel that re-renders the DSL source text as you drag blocks
around.

To point the app at a different grammar, just re-run the `parse.js` command
with a new `.langium` file — it overwrites `blockly_app/src/blocks.ts`,
`generator.ts`, and `main.ts` in place.

---

## Repository layout

```
generate_blockly/
  input/                  bundled example grammars (grammar.langium, recipe.langium,
                          todo_list.langium, state_machine.langium, adress_book.langium,
                          cross_refrences.langium)
  src/
    parse.js               CLI entry point / pipeline orchestrator
    grammar-loader.js       Step 1: parse .langium text -> Langium AST
    validator.js             Step 2: reject unsupported grammar constructs
    ast-utils.js               $type predicate helpers used throughout
    ir-builder.js            Step 3: Langium AST -> RuleIR[] (the IR)
    blockly-ts-target.js      Step 4: RuleIR[] -> blocks.ts/generator.ts/main.ts (used by parse.js)
    block-json-generator.js  standalone/legacy: RuleIR[] -> plain Blockly JSON (not used by parse.js)
    code-generator.js        standalone/legacy: RuleIR[] -> forBlock JS source (not used by parse.js)

blockly_app/
  index.html               page hosting the Blockly workspace + code/error panels
  src/
    reference-field.ts       STATIC (hand-maintained, never overwritten): FieldReference,
                              the custom dropdown field backing cross-references
    main.ts                 generated: workspace + toolbox + change listener
    blocks.ts                generated: Blockly.defineBlocksWithJsonArray(...)
    generator.ts              generated: generator.forBlock[...] functions

tests/
  validation/              unit + integration tests per pipeline module, plus a full
                            end-to-end round-trip test using a real headless Blockly.Workspace
  evaluation/               coverage test across every bundled/edge-case grammar, plus a
                            performance script benchmarking each pipeline stage
  helpers/                  shared test infrastructure (in-memory pipeline runner,
                             TS-to-ESM compiler + headless Blockly loader)
  fixtures/                 small hand-written .langium files for negative-path tests

package.json / package-lock.json  npm project + dependency lockfile (blockly, langium, vite, TS)
tsconfig.json                     TS config, scoped to blockly_app/src
vite.config.ts                    Vite root = blockly_app/
```

---

## The pipeline, file by file

Each module has a detailed doc comment at the top of its source file —
this section is a short summary, not a replacement for reading the code.

**`parse.js`** — CLI entry point. Runs the four stages below in order and
writes the three generated files to `blockly_app/src/`.

```bash
node generate_blockly/src/parse.js <path-to-grammar.langium>
```

**`grammar-loader.js`** — `loadGrammar(filename)` parses the file with
Langium's own grammar services and throws if the document has any
Error-severity diagnostics (syntax errors, undefined rule references).
Non-fatal diagnostics (e.g. an unused rule) don't block loading.

**`validator.js`** — `validateGrammar(grammar, options?)` walks every
parser rule and collects (rather than fail-fast on) every construct
outside the supported subset (see table below), throwing one `Error`
listing all violations. Override `options.allowedTypes` /
`options.allowedCardinalities` to relax the check.

**`ir-builder.js`** — `buildIR(grammar, { onWarning })` is where the
"what does this grammar construct mean as a Blockly input" decisions
live. Key mappings:
- `feature=ID` / `feature=INT` → `"field"` (text/number input)
- `feature=[Rule:TERMINAL]` (cross-reference) → `"reference"` (see
  "Cross-references" below)
- `feature=OtherRule` → `"value"` (a plug-in socket)
- `feature=(a|b|c)` of all keywords → `"dropdown"`
- `feature+=Rule` → `"statement"` (a stacking input)
- Bare `(a+=A | b+=B)*` alternatives with distinct features **merge into
  one shared statement input** (`refRuleNames: ["A","B"]`), since Blockly
  has no per-branch typing — this is what lets `Phone`/`Address` blocks
  interleave and stack together in the AddressBook example.
- Any other kind of mixed `Alternatives` falls back to its first branch
  and emits a warning, rather than crashing.

Also exports `findNameField`/`computeNameFields`: since Langium has no
explicit "this is the name" marker, a rule's first plain `feature=ID`
field is treated as its declared name (used by cross-references).

**`blockly-ts-target.js`** — the module `parse.js` actually calls.
`generateBlocksTs` builds each rule's Blockly JSON (arg names upper-
snake-cased); rules that are ever the target of a `+=` list get a shared
`previousStatement`/`nextStatement` "check" type (joined with `_or_` when
several rules merge into one statement input, see above). `generateGeneratorTs`
emits a `forBlock` function per rule that reads its inputs back and
reconstructs the DSL's own concrete syntax (a round-trip, not a compile-to-
something-else). `generateMainTs` wires up the workspace, toolbox, and a
change listener that re-renders the code panel on every edit.

**`block-json-generator.js`** / **`code-generator.js`** — standalone,
legacy generators not used by `parse.js`. Kept for anyone who wants plain
Blockly JSON or a plain-JS `forBlock` output without the rest of the
TypeScript scaffolding. `block-json-generator.js`'s `argBuilders` registry
is reused by `blockly-ts-target.js`, so the two stay in sync.

### Cross-references

A cross-reference (`feature=[TargetRule:TERMINAL]`, e.g.
`assignee=[Member:ID]`) means "point at an already-declared element by
name", unlike `feature=TargetRule` which nests a new one. Since Blockly's
plain `field_dropdown` can't reflect a workspace that keeps changing, this
pipeline ships a custom field, `FieldReference`
(`blockly_app/src/reference-field.ts`, **static — never regenerated**),
whose option list is recomputed live from every currently-declared block
of the target type each time the dropdown opens. It falls back to a plain
text field when the target rule has no name field to scan (see
`findNameField` above). See the doc comments in `ir-builder.js`,
`block-json-generator.js`, and `reference-field.ts` for the full
implementation details.

Known trade-offs: no scoping (every matching block on the whole workspace
is offered), and a renamed/deleted target silently falls back to the
first available option rather than flagging the dangling reference.

---

## Supported grammar subset and limitations

Only **parser rules** are processed (terminal rules like `ID`/`INT`/`WS`
are recognized by name inside assignments but not converted to blocks).

| Construct | Support |
|---|---|
| `Group` (sequencing) | ✅ |
| `Alternatives` (`\|`) | ✅ all-keyword → dropdown; all-list-assignment → merged statement input; other mixed alternatives → first branch only, with a warning |
| `Assignment` (`feature=`, `feature+=`) | ✅ |
| `Keyword` (literal text) | ✅ |
| `RuleCall` (reference to another rule) | ✅ |
| `CrossReference` (`feature=[TargetRule:TERMINAL]`) | ✅ live dropdown, falling back to plain text when the target has no name field |
| Cardinality `?`, `*`, `+`, none | ✅ |
| `UnorderedGroup` (`a & b`) | ✅ walked like a `Group` — elements always render/reconstruct in declaration order, not every valid ordering |
| `Action` | ❌ |
| Any other cardinality | ❌ |

Running the validator against an unsupported grammar throws an `Error`
listing every offending location — nothing is generated.

---

## Extending the pipeline

To support a new Langium construct end-to-end, you generally touch three
places:

1. **`validator.js`** — add the `$type` to `allowedTypes`; if it's a
   container node, add a `case` in the `walk` switch so children are
   validated too.
2. **`ir-builder.js`** — add a handler to `nodeHandlers` (or a branch in
   `handleAssignment`) that appends the right `IRPart`.
3. **`blockly-ts-target.js`** (and/or `block-json-generator.js` /
   `code-generator.js`) — if it's a new `IRPart.kind`, add an entry to the
   relevant `argBuilders`/`partTemplates` registry so the output knows how
   to render it.

The cross-reference feature (`CrossReference` → `"reference"` IRPart) is a
worked example of this pattern, including adding a brand-new custom
Blockly field — see `reference-field.ts` if you need to add another one.

---

## Testing

```bash
npm test          # validation only (node:test, fast)
npm run test:eval  # evaluation: coverage test (node:test)
npm run test:perf   # evaluation: performance report (plain script, prints a table)
npm run test:all     # all three, in order
```

No test framework dependency beyond Node's built-in `node:test` +
`node:assert/strict`.

**`tests/validation/`** — is the output correct?

| File | Checks |
|---|---|
| `grammar-loader.test.js` | accepts well-formed grammars; rejects syntax/linking errors; tolerates non-fatal diagnostics |
| `validator.test.js` | accepts every bundled grammar + `UnorderedGroup`; rejects unsupported constructs (incl. nested inside an `UnorderedGroup`); reports *all* violations, not just the first; `allowedTypes` override works |
| `ir-builder.test.js` | each documented `IRPart.kind` mapping; merged-alternatives collapse; anonymous-dropdown and mixed-alternatives fallback; `findNameField`/`computeNameFields` |
| `block-json-generator.test.js` | standalone JSON generator's `argBuilders`, including both cross-reference branches |
| `blockly-ts-target.test.js` | shared `_or_` check types; value vs. stackable block detection; arg name casing; generated `forBlock` bodies; entry/non-entry toolbox split |
| `roundtrip.test.js` | compiles real generated `blocks.ts`/`generator.ts` to JS, runs them against a real headless `Blockly.Workspace`, and asserts the reconstructed DSL text matches exactly — the deepest end-to-end check |

**`tests/evaluation/`** — does it work for everything, and how fast?

| File | Checks |
|---|---|
| `coverage.test.js` | every bundled/fixture grammar produces its expected outcome (success / fails-at-load / fails-at-validate); every documented `IRPart.kind` is exercised somewhere; `Action` is still rejected |
| `performance.js` | times each pipeline stage for bundled grammars and synthetic grammars of 1–200 rules, printing scaling ratios |

`tsconfig.json` only type-checks `blockly_app/src` — the `generate_blockly/`
CLI pipeline is plain Node.js ESM and isn't type-checked by `tsc`.
