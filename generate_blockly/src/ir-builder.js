import { isParserRule } from './ast-utils.js';

/**
 * @typedef {Object} IRPart
 * @property {"keyword"|"field"|"dropdown"|"value"|"statement"} kind
 * @property {string} [text]        - literal text, for "keyword" parts
 * @property {string} [feature]     - grammar feature name, for input parts
 * @property {"text"|"number"} [fieldType] - for "field" parts
 * @property {Array<[string,string]>} [options] - for "dropdown" parts
 * @property {string} [refRuleName] - referenced parser rule, for "value" parts
 * @property {boolean} [optional]   - cardinality "?"
 * @property {boolean} [repeatable] - cardinality "*" / "+" / operator "+="
 *
 * @typedef {Object} RuleIR
 * @property {string} name
 * @property {IRPart[]} parts
 */

/**
 * Registry mapping AST node `$type` -> handler(node, ctx) that appends
 * IRParts to ctx.parts. To support a new grammar construct later, add a
 * new entry here instead of editing existing handlers.
 */
const nodeHandlers = {

    Group(node, ctx) {
        for (const e of node.elements)
            visit(e, ctx);
    },

    Alternatives(node, ctx) {
        const allKeywords = node.elements.every(e => e.$type === "Keyword");

        if (allKeywords) {
            // A bare (unassigned) set of alternative keywords becomes an
            // anonymous dropdown - there's no feature name to key it on,
            // so we mint one.
            ctx.parts.push({
                kind: "dropdown",
                feature: ctx.nextAnonymousFeature(),
                options: node.elements.map(e => [e.value, e.value])
            });
            return;
        }

        // Mixed alternatives (keywords + rule calls etc.) aren't fully
        // representable as a single Blockly input yet. Fall back to the
        // first branch so the pipeline still produces something, and
        // surface a warning so the user knows it's a simplification.
        ctx.warnings.push(
            "Alternatives with non-keyword branches are only partially " +
            "supported; using the first branch only."
        );
        visit(node.elements[0], ctx);
    },

    Keyword(node, ctx) {
        ctx.parts.push({ kind: "keyword", text: node.value });
    },

    Assignment(node, ctx) {
        handleAssignment(node, ctx);
    },

    RuleCall(node, ctx) {
        // A bare (unassigned) rule call - uncommon in the restricted
        // subset, kept for forward compatibility.
        ctx.parts.push({
            kind: "value",
            feature: ctx.nextAnonymousFeature(),
            refRuleName: node.rule?.ref?.name
        });
    }
};

function visit(node, ctx) {

    if (!node)
        return;

    const handler = nodeHandlers[node.$type];

    if (!handler) {
        ctx.warnings.push(`No IR handler for node type "${node.$type}", skipping.`);
        return;
    }

    handler(node, ctx);
}

function handleAssignment(node, ctx) {

    const cardinality = node.cardinality; // undefined | '?' | '*' | '+'
    const optional = cardinality === '?';
    const repeatable = cardinality === '*' || cardinality === '+' || node.operator === '+=';

    // List-valued features (+=) map to Blockly statement inputs: the user
    // stacks one block per repetition. This is the idiomatic Blockly way
    // to express repetition and needs no custom mutator UI.
    if (node.operator === '+=') {
        // Capture which rule this list repeats over (when it's a plain
        // rule reference) so downstream targets can connect the two -
        // e.g. giving the referenced rule's block a self-typed
        // previousStatement/nextStatement so instances of it stack.
        const refRuleName = node.terminal?.$type === "RuleCall"
            ? node.terminal.rule?.ref?.name
            : undefined;

        ctx.parts.push({
            kind: "statement",
            feature: node.feature,
            optional,
            repeatable: true,
            refRuleName
        });
        return;
    }

    const terminal = node.terminal;

    if (terminal?.$type === "RuleCall") {

        const refName = terminal.rule?.ref?.name;

        switch (refName) {

            case "ID":
                ctx.parts.push({ kind: "field", feature: node.feature, fieldType: "text", optional, repeatable });
                return;

            case "INT":
                ctx.parts.push({ kind: "field", feature: node.feature, fieldType: "number", optional, repeatable });
                return;

            default:
                // Reference to another parser rule -> plug-in input.
                ctx.parts.push({ kind: "value", feature: node.feature, refRuleName: refName, optional, repeatable });
                return;
        }
    }

    if (terminal?.$type === "Alternatives") {

        const allKeywords = terminal.elements.every(e => e.$type === "Keyword");

        if (allKeywords) {
            ctx.parts.push({
                kind: "dropdown",
                feature: node.feature,
                options: terminal.elements.map(e => [e.value, e.value]),
                optional,
                repeatable
            });
            return;
        }
    }

    // Anything else (mixed alternatives, groups, cross-references once
    // supported, ...) becomes a generic plug-in value input.
    ctx.parts.push({ kind: "value", feature: node.feature, optional, repeatable });
}

/**
 * @param {object} grammar - Langium grammar AST (from loadGrammar).
 * @param {object} [options]
 * @param {(msg: string) => void} [options.onWarning] - called for each
 *   simplification/skip made while building the IR.
 * @returns {RuleIR[]}
 */
export function buildIR(grammar, options = {}) {

    const rules = [];
    const warnings = [];

    for (const rule of grammar.rules) {

        if (!isParserRule(rule))
            continue;

        let anon = 0;

        const ctx = {
            parts: [],
            warnings,
            nextAnonymousFeature: () => `anon${anon++}`
        };

        visit(rule.definition, ctx);

        rules.push({ name: rule.name, parts: ctx.parts });
    }

    if (warnings.length && options.onWarning) {
        warnings.forEach(options.onWarning);
    }

    return rules;
}

// Exported so callers (or future support for new node types) can extend
// the registry: `nodeHandlers.UnorderedGroup = (node, ctx) => {...}`.
export { nodeHandlers };
