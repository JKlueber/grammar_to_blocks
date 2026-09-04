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

> The top-level `README.md` in this repo (before this rewrite) only showed
> the one-line invocation:
> `node generate_blockly/src/parse.js generate_blockly/input/robot.langium`
> — that's the same command shown above, just against a different example
> grammar file (`robot.langium`, not included in this listing).

---

## Repository layout

```
generate_blockly/
  input/
    grammar.langium       example grammar (AddressBook) used above
  src/
    parse.js               CLI entry point / pipeline orchestrator
    grammar-loader.js       Step 1: parse .langium text -> Langium AST
    validator.js             Step 2: reject unsupported grammar constructs
    ast-utils.js               $type predicate helpers used throughout
    ir-builder.js            Step 3: Langium AST -> RuleIR[] (the IR)
    blockly-ts-target.js      Step 4: RuleIR[] -> blocks.ts/generator.ts/main.ts
    block-json-generator.js  standalone/legacy: RuleIR[] -> plain Blockly JSON
    code-generator.js        standalone/legacy: RuleIR[] -> forBlock JS source

blockly_app/
  index.html               page hosting the Blockly workspace + code/error panels
  src/
    reference-field.ts       STATIC (hand-maintained, never overwritten):
                              FieldReference, the custom dropdown field
                              backing cross-references - see "How
                              cross-references work" below
    main.ts                 generated: workspace + toolbox + change listener
    blocks.ts                generated: Blockly.defineBlocksWithJsonArray(...)
                              (imports reference-field.ts for its
                              registration side effect)
    generator.ts              generated: generator.forBlock[...] functions

package.json / package-lock.json  npm project + dependency lockfile (blockly, langium, vite, TS)
tsconfig.json                     TS config, scoped to blockly_app/src
vite.config.ts                    Vite root = blockly_app/
.gitignore                        ignores node_modules
```

---

## The generation pipeline, file by file

### `generate_blockly/src/parse.js` — CLI entry point

Run as:

```bash
node generate_blockly/src/parse.js <path-to-grammar.langium>
```

It does exactly four things, matching the diagram above:

1. `loadGrammar(filename)` — parse the grammar file into a Langium AST.
2. `validateGrammar(grammar)` — throw if the grammar uses anything outside
   the supported subset.
3. `buildIR(grammar, { onWarning })` — build the intermediate representation,
   logging any simplifications made along the way (e.g. `console.warn`).
4. Write `generateBlocksTs(ir)`, `generateGeneratorTs(ir)`, and
   `generateMainTs(ir)` to `blockly_app/src/blocks.ts`, `generator.ts`, and
   `main.ts` respectively, then print how many blocks were generated.

If no filename is given, it prints usage and exits with status 1.

### `generate_blockly/src/grammar-loader.js` — parsing `.langium` text

`loadGrammar(filename)` spins up Langium's own grammar language services
(`createLangiumGrammarServices(EmptyFileSystem)`), reads the file, builds a
`LangiumDocument` from its text, and asks the `DocumentBuilder` to fully
build/validate it. If the document has any diagnostics (syntax or semantic
errors in the grammar itself), it throws `"Grammar contains errors."`.
Otherwise it returns `document.parseResult.value` — the parsed `Grammar` AST
node, with `.rules` being the list of parser/terminal rules.

### `generate_blockly/src/ast-utils.js` — AST type predicates

Small `$type`-checking helpers (`isParserRule`, `isTerminalRule`,
`isKeyword`, `isAssignment`, `isGroup`, `isAlternatives`, `isRuleCall`,
`isCrossReference`, plus `getCardinality(node)` for reading a node's
`?`/`*`/`+` repetition marker) used by the validator and IR builder so
nobody has to compare `.$type` string literals by hand. Also declares (but
doesn't yet use) `isUnorderedGroup`, left as a forward-compatibility hook
for when that Langium construct gets support added.

### `generate_blockly/src/validator.js` — enforcing the supported subset

`validateGrammar(grammar, options?)` walks every **parser rule's**
definition tree (terminal rules are skipped) and collects — rather than
throws on the first — every construct that falls outside:

- `DEFAULT_ALLOWED_TYPES`: `Grammar`, `ParserRule`, `Group`, `Alternatives`,
  `Assignment`, `Keyword`, `RuleCall`, `CrossReference`.
- `DEFAULT_ALLOWED_CARDINALITIES`: no cardinality at all, `?`, `*`, `+`.

If it finds unsupported node types or cardinalities anywhere in a rule, it
throws one `Error` whose message lists every problem found, each tagged with
the rule it came from (so you get a full report instead of playing whack-a-mole).
On success it returns `true`.

`CrossReference` nodes (`feature=[TargetRule:TERMINAL]`) are treated as a
leaf, the same as `Keyword`/`RuleCall` — the validator doesn't need to
descend into the reference's own target-rule/terminal, since there's nothing
underneath it that could itself violate the subset.

You can override which types/cardinalities are allowed via
`options.allowedTypes` / `options.allowedCardinalities` if you extend the
rest of the pipeline to support more constructs (the file's docstring
specifically calls out `UnorderedGroup` as the likely next addition).

### `generate_blockly/src/ir-builder.js` — grammar AST → IR

This is the heart of the "what does this grammar rule *mean* as a UI
input" logic. `buildIR(grammar, { onWarning })` returns an array of:

```ts
RuleIR = {
  name: string,       // parser rule name, e.g. "Contact"
  parts: IRPart[]      // ordered pieces that make up the rule's block
}

IRPart = {
  kind: "keyword" | "field" | "dropdown" | "value" | "statement" | "reference",
  text?: string,              // literal text, for "keyword"
  feature?: string,            // grammar feature name, for the other kinds
                                //   (see "merged statement parts" below for
                                //   how this is derived when several
                                //   features feed one shared input)
  fieldType?: "text"|"number", // for "field" parts
  options?: [string,string][], // for "dropdown"
  refRuleName?: string,        // the referenced rule, for "value" parts,
                                //   "reference" parts (see below), and for
                                //   the common single-rule "statement" case
                                //   (feature+=Rule); undefined when a
                                //   "statement" part names more than one rule
  refRuleNames?: string[],     // every rule allowed to fill a "statement"
                                //   part - see below
  optional?: boolean,          // cardinality "?"
  repeatable?: boolean         // cardinality "*"/"+" or operator "+="
}
```

Traversal is dispatched through the `nodeHandlers` registry (`Group`,
`Alternatives`, `Keyword`, `Assignment`, `RuleCall`, `CrossReference`), each
appending `IRPart`s to a per-rule context. The interesting decisions:

- **`Assignment` (`feature=...`)** is where most of the mapping logic lives
  (`handleAssignment`):
  - `feature += X` (a list assignment) always becomes a `"statement"` IR
    part — i.e. a Blockly statement input where the user stacks one block
    per list item. If the repeated element is a plain rule reference, the
    referenced rule name is recorded in **both** `refRuleName` (a single
    string, for convenience) and `refRuleNames` (a one-element array), so
    downstream code can always read `refRuleNames` regardless of which path
    built the part — see the next bullet.
  - `feature=ID` / `feature=INT` become `"field"` IR parts (`field_input` /
    `field_number` in Blockly terms).
  - **`feature=[TargetRule:TERMINAL]` (a cross-reference, e.g.
    `assignee=[Member:ID]`) becomes a `"reference"` IR part.** See
    "How cross-references work" below.
  - `feature=SomeOtherRule` becomes a `"value"` IR part (a plug-in
    `input_value` socket).
  - `feature=(A | B | C)` where all alternatives are keywords becomes a
    `"dropdown"` IR part with one `[label, value]` option per keyword.
  - Anything else (mixed alternatives, nested groups, etc.) falls back to a
    generic `"value"` part.
- **Bare `Alternatives`** (no `feature=` in front of the whole group) is
  checked against three shapes, in order:
  1. *All branches are keywords* (`'a' | 'b' | 'c'`) → one anonymous
     `"dropdown"` part (feature name auto-generated as `anon0`, `anon1`,
     ...), one option per keyword.
  2. *All branches are list assignments to different features*
     (`phones+=Phone | addresses+=Address`) → **merged statement parts**.
     This is the case the bundled `AddressBook` grammar uses
     (`(phones+=Phone | addresses+=Address)*`). Since the DSL only cares
     about the interleaved *order* entries appear in, not which grammar
     feature they were assigned to, all branches collapse into **one**
     shared Blockly statement input instead of one input per feature.
     Its `feature` is every branch's feature name joined with `_`
     (`"phones_addresses"`), and its `refRuleNames` lists every rule that
     can drop into that slot (`["Phone", "Address"]`). Downstream, this is
     what lets `Phone` and `Address` blocks stack directly above/below each
     other in the same input — see
     [`blockly-ts-target.js`](#generate_blockly-src-blockly-ts-target-js--ir--the-actual-output-files)
     below for how that shared "check" type is computed.
  3. *Anything else* (keywords mixed with rule calls, nested groups, etc.)
     isn't representable as a single Blockly input yet. The IR builder
     falls back to visiting **only the first branch**, so the pipeline
     still produces something, and pushes a warning so the simplification
     is visible instead of silent.
- **Bare `RuleCall`** (no assignment) becomes an anonymous `"value"` part —
  kept mostly for forward compatibility, since the restricted subset
  doesn't commonly produce these.
- **Bare `CrossReference`** (no assignment) becomes an anonymous
  `"reference"` part — again mostly for forward compatibility, since
  cross-references almost always appear behind a `feature=` assignment.
- Any node type with no registered handler pushes a warning and is skipped
  rather than crashing the whole build.

Warnings collected during the walk are all passed to `options.onWarning`
(if provided) once IR building finishes — `parse.js` wires this to
`console.warn`.

#### How cross-references work

A Langium cross-reference (`feature=[TargetRule:TERMINAL]`, e.g.
`assignee=[Member:ID]` in `Task`) means "point at an *already-declared*
`Member` by the name it was given", as opposed to `assignee=Member`, which
would mean "nest a brand-new `Member` right here".

Blockly has no *built-in* widget for "pick an existing block instance by
name" — a plain `field_dropdown`'s option list is fixed at block-definition
time, and a cross-reference's valid options change as the user adds,
renames, or removes blocks on the workspace. So this pipeline ships a small
**custom field**, `FieldReference` (see
`blockly_app/src/reference-field.ts`), whose option list is computed live
by scanning the workspace every time the dropdown is opened. Concretely,
across the four files involved:

1. **`ir-builder.js`** turns the assignment into an IR part with
   `kind: "reference"` and `refRuleName` set to the *referenced* parser
   rule (`terminal.type?.ref?.name`, i.e. `"Member"` for `assignee`). It
   also exposes `findNameField(rule)` / `computeNameFields(irRules)`: since
   nothing in a Langium grammar explicitly marks "this feature is the
   element's name", these use the convention every example grammar here
   already follows — a rule's first plain `feature=ID` text field (`name`,
   `title`, ...) is treated as its declared name.
2. **`block-json-generator.js`**'s `argBuilders.reference` looks up the
   *target* rule's name field in that map and, if one exists, emits
   `{ "type": "field_reference", "referencesType": "<targetRule>",
   "nameField": "<its name arg>" }` instead of a plain `field_input`. If
   the target rule has no text field to scan for (e.g. it's built purely
   from keywords/numbers), there's nothing to build a dropdown from, so it
   falls back to the old plain-text `field_input` — the pipeline never
   crashes, it just degrades to typed text for that one case.
3. **`blockly_app/src/reference-field.ts`** — a **static, hand-maintained**
   file (like `index.html`; unlike `blocks.ts`/`generator.ts`/`main.ts`,
   it is *not* overwritten by `parse.js`) — defines `FieldReference`, a
   `Blockly.FieldDropdown` subclass that overrides `getOptions()` to scan
   `workspace.getAllBlocks()` for every block whose type matches
   `referencesType`, read each one's `nameField`, and return the
   deduplicated, sorted set of currently-declared names as the dropdown's
   options. It's registered once via `Blockly.fieldRegistry.register(...)`
   so any block JSON with `"type": "field_reference"` resolves to it.
   `generateBlocksTs` (`blockly-ts-target.js`) adds
   `import './reference-field';` to every generated `blocks.ts` purely for
   this registration side effect.
4. **`blockly-ts-target.js`**'s generator output still reads a `"reference"`
   field back with `block.getFieldValue(...)` — the exact same call used
   for plain `"field"` inputs, since `FieldReference` (like every
   `FieldDropdown`) stores its current value as a plain string. This is
   what keeps the code generator itself unaware of the switch from
   free text to a live dropdown: whichever name the user *picked* is
   spliced straight into the reconstructed DSL source, unchanged.

**Trade-offs, by design** (see `reference-field.ts`'s doc comment for the
authoritative list):
- Only rules with a plain `feature=ID` name field are scannable; others
  fall back to free text.
- **No scoping** — every block of the target type anywhere on the
  workspace is offered, regardless of where the referencing block sits.
  Langium's own cross-references can be scope-restricted; this
  implementation treats every declared name as globally visible.
- If the block that owns the currently-selected name gets renamed or
  deleted, the field's stored value just stops matching a live option;
  Blockly silently falls back to the first available option next time the
  dropdown opens. Nothing actively flags or repairs a now-dangling
  reference.


### `generate_blockly/src/blockly-ts-target.js` — IR → the actual output files

This is the module `parse.js` actually calls to produce output (the other
two generator modules below are **not** wired into the CLI — see the note
at the end of this section). It exports three functions:

- **`generateBlocksTs(irRules)`** → contents of `blocks.ts`. Converts each
  rule's `parts` into a Blockly JSON block definition (`message0` built by
  concatenating keyword text and `%N` placeholders, `args0` built via the
  shared `argBuilders` from `block-json-generator.js`, arg names upper-
  snake-cased via `toArgName`). Rules that are the target of some `+=` list
  elsewhere in the grammar (`computeStackTypes`) get
  `previousStatement`/`nextStatement` set to a shared "check" type computed
  from every rule named in that statement part's `refRuleNames` (sorted and
  joined with `_or_`, e.g. `"address_or_phone"` for the AddressBook
  grammar's merged `Phone`/`Address` input); a rule that's the sole target
  of its own `+=` list reduces to just its own lowercase name, so existing
  single-type grammars generate identical output to before this feature
  was added. Rules that aren't a `+=` target at all get `null`/`null`.
  `"reference"` (cross-reference) parts never get a `check`, since — unlike
  `"value"` parts — they aren't a socket another block plugs into; see
  "How cross-references work" above. This function also computes
  `nameFields` (`ir-builder.js#computeNameFields`) once per run and threads
  it through to `argBuilders.reference`, and prepends
  `import './reference-field';` to the emitted source so the custom
  `field_reference` field (used by any resolved cross-reference dropdown)
  is registered before Blockly renders anything.
- **`generateGeneratorTs(irRules)`** → contents of `generator.ts`. For each
  rule, emits a `generator.forBlock['<ruletype>'] = function (block) {...}`
  that reads each field/value/statement/reference input back out (via
  `block.getFieldValue`, `generator.valueToCode`, or
  `generator.statementToCode`) and concatenates them — keywords included —
  back into the rule's original concrete syntax, trimmed of extra
  whitespace where relevant. This is a **round-tripping** strategy: it
  reconstructs the DSL's own text, not some other target language. `"field"`,
  `"dropdown"`, and `"reference"` parts are all read back with the same
  `block.getFieldValue(...)` call, since they're all backed by a single
  Blockly field — this holds whether a `"reference"` part rendered as the
  live `field_reference` dropdown or fell back to plain `field_input`; the
  generator code is identical either way, it just reads back whichever
  name the user picked or typed. If you want a block to actually *compile
  to something else* (the way the hand-written `rbac_*` blocks referenced
  in the code comments apparently do), you edit the generated function by
  hand afterwards.
- **`generateMainTs(irRules)`** → contents of `main.ts`. Wires up
  `defineBlocks()`, injects the Blockly workspace into `#blocklyDiv` with a
  flyout toolbox listing one block per rule, and adds a change listener
  that calls `generator.workspaceToCode(workspace)` on every edit, writing
  the result into `#codeOutput` (or the caught error into `#errorOutput`).

### `generate_blockly/src/block-json-generator.js` — standalone JSON generator (not called by `parse.js`)

Exports `generateBlockJson(irRules)`, which maps each `RuleIR` to a plain
Blockly JSON block definition (`{ type, message0, args0, previousStatement,
nextStatement, colour }`) suitable for
`Blockly.defineBlocksWithJsonArray(...)` directly — feature names are used
as-is (not upper-snake-cased) and every block defaults to
`previousStatement`/`nextStatement: null` regardless of whether it's used
in a `+=` list (this file predates the merged-statement/`refRuleNames`
support described above, so it doesn't compute shared "check" types).
Also exports its `argBuilders` registry, which `blockly-ts-target.js`
actually imports and reuses — this is the single place that knows how to
turn each `IRPart.kind` (including `"reference"`) into Blockly JSON, so both
targets stay in sync. Useful if you want Blockly JSON without the
TypeScript/generator/main scaffolding that `blockly-ts-target.js` produces.

### `generate_blockly/src/code-generator.js` — standalone JS forBlock generator (not called by `parse.js`)

Exports `generateCodeGenerators(irRules, { generatorName })`, which emits
plain JavaScript `<generatorName>.forBlock[...] = function (block, generator) {...}`
definitions (default `generatorName: "Blockly.JavaScript"`) using its own
`partTemplates` registry — a JS/CommonJS-flavored counterpart to
`ruleToGeneratorFunction` in `blockly-ts-target.js`, useful if you're
integrating generated blocks into a plain-JS (non-Vite/TS) Blockly setup
instead of the `blockly_app/` scaffold in this repo.

---

## The generated/consumed app: `blockly_app/`

- **`index.html`** — static page with a `#blocklyDiv` workspace container,
  a `#codeOutput` panel (green-on-black, monospace) and `#errorOutput`
  panel (red), plus some unused CSS for an `#evaluator` section (a hook for
  adding a domain-specific "run this DSL" panel by hand later — not wired
  up by anything generated). Loads `./src/main.ts` as a module script.
- **`src/main.ts`**, **`src/blocks.ts`**, **`src/generator.ts`** — these
  three files are **overwritten every time you run `parse.js`**. The copies
  currently checked in correspond to the bundled example grammar
  (`generate_blockly/input/grammar.langium`, an `AddressBook` grammar with
  `Contact` → `Phone`/`Address`) — i.e. they're the *output* of already
  having run:
  ```bash
  node generate_blockly/src/parse.js generate_blockly/input/grammar.langium
  ```
  If you look at `blocks.ts`/`generator.ts` you can see the pattern described
  above concretely: `phone` and `address` both got
  `previousStatement`/`nextStatement: "address_or_phone"` because `Contact`
  does `(phones+=Phone | addresses+=Address)*`, merging both into one
  shared statement input (see "merged statement parts" above); `addressbook`
  and `contact` did not, since `AddressBook`'s `contacts+=Contact` only
  ever targets `Contact` alone, so its check type reduces to plain
  `"contact"`.

Since `generator.ts` in this snapshot imports `javascriptGenerator` from
`'blockly/javascript'` and re-exports it as `generator`, `blockly_app`
depends on Blockly's bundled JavaScript generator purely as a vehicle for
its `forBlock`/`statementToCode`/`valueToCode` machinery — none of the
generated code actually emits JavaScript; it reconstructs the original DSL
syntax (see `generateGeneratorTs` above).

---

## Supported grammar subset and limitations

Only **parser rules** are processed (terminal rules like `ID`/`INT`/`WS`
are recognized by name inside assignments but not independently converted
to blocks). Within a parser rule's definition, the validator currently
allows only:

| Construct | Support |
|---|---|
| `Group` (sequencing) | ✅ |
| `Alternatives` (`\|`) | ✅ (all-keyword → dropdown; all-list-assignment → merged statement input; other mixed alternatives → first branch only, with a warning) |
| `Assignment` (`feature=`, `feature+=`) | ✅ |
| `Keyword` (literal text) | ✅ |
| `RuleCall` (reference to another rule) | ✅ |
| `CrossReference` (`feature=[TargetRule:TERMINAL]`) | ✅ rendered as a live dropdown (`field_reference`) scoped to the target rule's currently-declared names, falling back to a plain text field when the target rule has no name to scan for — see "How cross-references work" above |
| Cardinality `?`, `*`, `+`, none | ✅ |
| `UnorderedGroup` | ❌ not yet — flagged by the validator, hooks exist in `ast-utils.js` |
| `Action` | ❌ not referenced by the validator's allowed-types set |
| Any other cardinality value | ❌ |

Running the validator against a grammar that uses unsupported constructs
throws an `Error` listing every offending location — nothing is generated.

`ID`-typed and `INT`-typed features become Blockly `field_input` /
`field_number` inputs; any other rule reference becomes a plug-in
`input_value` socket; a cross-reference (`feature=[TargetRule:TERMINAL]`)
becomes a live-scanned `field_reference` dropdown listing the target
rule's currently-declared names (or a plain `field_input` fallback if that
rule has no name field to scan for) — no socket/"check" type either way,
since nothing is actually plugged in, just named — see "How
cross-references work" above; `feature+=X` becomes a stacking
`input_statement` socket, and `X`'s own block gets self-typed
`previousStatement`/`nextStatement` so multiple instances chain together.
When several `+=` branches are merged via alternatives (`(a+=A | b+=B)*`),
every named rule instead gets a shared check type so instances of *any* of
them can chain together in that one input — see "merged statement parts"
above.

> `generate_blockly/input/invalid.langium`'s `Task` rule uses
> `assignee=[Member:ID]`, a cross-reference — this now parses and generates
> a block successfully, with `assignee` rendered as a live dropdown of
> every declared `Member`'s name, since cross-references are part of the
> supported subset. That file's name/warning value now comes only from its
> other construct(s); check the validator's error output for the current
> file to see exactly what (if anything) it still rejects.

---

## Extending the pipeline

To support a new Langium construct end-to-end you generally touch three
places:

1. **`validator.js`** — add the new `$type` to `allowedTypes` (or pass a
   custom set) and, if it's a container node, add a `case` in the `walk`
   switch so its children get validated too.
2. **`ir-builder.js`** — add a handler to the `nodeHandlers` registry (or a
   branch inside `handleAssignment`) that appends the right kind of
   `IRPart`.
3. **`blockly-ts-target.js`** (and/or `block-json-generator.js` /
   `code-generator.js` if you use those instead) — if it's a genuinely new
   `IRPart.kind`, add an entry to the relevant `argBuilders`/
   `partTemplates` registry so the JSON/codegen output knows how to render it.

The cross-reference feature (`CrossReference` → `"reference"` IRPart) is a
worked example of exactly this three-step extension, taken a step further:
after the initial free-text version, it was upgraded to a live, workspace-
scanning dropdown without changing the IR shape at all — only
`block-json-generator.js`'s `reference` builder, `blockly-ts-target.js`'s
plumbing of the new `nameFields` map, and a brand-new *static* file,
`blockly_app/src/reference-field.ts`, changed. See the diffs across those
files plus `ir-builder.js`'s `computeNameFields`, and the "How
cross-references work" section above for the full walkthrough. This is
also the pattern to follow for a genuinely new **custom field** (as
opposed to a new grammar construct): add a hand-maintained field module
under `blockly_app/src/`, have the relevant IR-part's `argBuilders` entry
emit its `"type"`, and have `generateBlocksTs` import the module for its
registration side effect.

---

## Dependencies

From `package.json`:

- **Runtime**: `blockly` (^12.5.1), `langium` (^4.1.0)
- **Dev**: `typescript` (^6.0.3), `vite` (^8.1.5), `@types/node`

npm scripts:

```bash
npm run dev       # vite dev server for blockly_app/
npm run build      # tsc (type-check blockly_app/src) then vite build
npm run preview     # preview the production build
```

`tsconfig.json` only type-checks `blockly_app/src` — the `generate_blockly/`
CLI pipeline is plain Node.js (ESM, `"type": "module"` in `package.json`)
and isn't type-checked by `tsc`.
