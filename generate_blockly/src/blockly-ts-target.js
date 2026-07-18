import { argBuilders } from './block-json-generator.js';

/**
 * Blockly convention (seen throughout the hand-written rbac_* blocks) is
 * to name args in SCREAMING_SNAKE_CASE ('NAME', 'ROLE', 'EFFECT', ...)
 * while local variables in the generator use the readable camelCase
 * feature name ('role', 'effect', ...). These two helpers keep that
 * mapping in one place so every generator in this file agrees on it.
 */
function toArgName(feature) {
    return feature
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toUpperCase();
}

function safeVarName(feature) {
    return feature.replace(/[^a-zA-Z0-9_]/g, "_");
}

function indent(text, spaces) {
    const pad = " ".repeat(spaces);
    return text.split("\n").map(line => pad + line).join("\n");
}

/**
 * A "statement" IR part can now name more than one referenced rule -
 * `(phones+=Phone | addresses+=Address)*` merges into a single input
 * whose `refRuleNames` is `["Phone", "Address"]`. Every rule named by
 * such a part needs to be able to (a) drop into that statement input
 * and (b) connect directly above/below every *other* rule named by the
 * same part, so the group is given one shared check/type string rather
 * than each rule keeping its own name as before. A rule that only ever
 * appears alone (the common `feature+=X` case) still ends up in a
 * "group" of one, which reduces to its own lowercase name - so existing
 * single-type grammars generate identical output to before.
 *
 * @returns {Map<string,string>} rule name (lowercase) -> shared check string
 */
function computeStackTypes(irRules) {

    const typeByRule = new Map();

    for (const rule of irRules) {
        for (const part of rule.parts) {

            if (part.kind !== "statement")
                continue;

            const names = (part.refRuleNames?.length ? part.refRuleNames : (part.refRuleName ? [part.refRuleName] : []))
                .map(n => n.toLowerCase());

            if (!names.length)
                continue;

            const check = [...names].sort().join("_or_");

            for (const n of names)
                typeByRule.set(n, check);
        }
    }

    return typeByRule;
}

/**
 * Turns a grammar feature name into a short human-readable label so
 * inputs aren't just bare, unlabelled placeholders in the Blockly
 * workspace (e.g. `name` -> "Name", `phones_addresses` -> "Phones /
 * Addresses", the auto-generated `anon0` -> "Option").
 */
function humanizeFeature(feature) {

    if (/^anon\d+$/.test(feature))
        return "Option";

    return feature
        .split("_")
        .map(word => word.replace(/([a-z0-9])([A-Z])/g, "$1 $2"))
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" / ");
}

/**
 * Deterministic hue (0-359) from a rule name, so each block type gets a
 * stable, distinct colour across regenerations instead of Blockly's
 * default (every block the same grey).
 */
function colourForRule(name) {

    let hash = 0;

    for (const ch of name)
        hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

    return hash % 360;
}

function partToArg(part, stackTypes) {

    const builder = argBuilders[part.kind];

    if (!builder)
        throw new Error(`No block-json builder for IR part kind "${part.kind}"`);

    const arg = { ...builder(part), name: toArgName(part.feature) };

    if (part.kind === "statement") {

        const names = (part.refRuleNames?.length ? part.refRuleNames : (part.refRuleName ? [part.refRuleName] : []))
            .map(n => n.toLowerCase());

        const checks = [...new Set(names.map(n => stackTypes.get(n)))].filter(Boolean);

        if (checks.length)
            arg.check = checks.length === 1 ? checks[0] : checks;
    }

    return arg;
}

function ruleToBlockJson(rule, stackTypes) {

    const block = { type: rule.name.toLowerCase(), message0: "", args0: [] };

    let placeholder = 1;

    for (const part of rule.parts) {

        if (part.kind === "keyword") {
            block.message0 += part.text + " ";
            continue;
        }

        // Label every non-literal input with its grammar feature name so
        // the block reads like "Name: [___]" instead of a bare, unlabelled
        // input - this is what actually makes a generated block legible.
        block.message0 += `${humanizeFeature(part.feature)}: %${placeholder++} `;
        block.args0.push(partToArg(part, stackTypes));
    }

    block.message0 = block.message0.trim();
    block.colour = colourForRule(rule.name);

    const stackType = stackTypes.get(rule.name.toLowerCase());

    if (stackType) {
        block.previousStatement = stackType;
        block.nextStatement = stackType;
    } else {
        block.previousStatement = null;
        block.nextStatement = null;
    }

    return block;
}

/**
 * @param {import('./ir-builder.js').RuleIR[]} irRules
 * @returns {string} contents of blocks.ts
 */
export function generateBlocksTs(irRules) {

    const stackTypes = computeStackTypes(irRules);
    const blocks = irRules.map(rule => ruleToBlockJson(rule, stackTypes));
    const blocksLiteral = indent(JSON.stringify(blocks, null, 2), 4);

    return `import * as Blockly from 'blockly';

// Export a function to define our blocks
export function defineBlocks() {
  Blockly.defineBlocksWithJsonArray(
${blocksLiteral}
  );
}
`;
}

function ruleToGeneratorFunction(rule) {

    const blockType = rule.name.toLowerCase();
    const setupLines = [];
    const codeFragments = [];

    for (const part of rule.parts) {

        if (part.kind === "keyword") {
            codeFragments.push(JSON.stringify(part.text + " "));
            continue;
        }

        const varName = safeVarName(part.feature);
        const argName = toArgName(part.feature);

        switch (part.kind) {

            case "field":
            case "dropdown":
                setupLines.push(`  const ${varName} = block.getFieldValue('${argName}');`);
                codeFragments.push(`${varName} + ' '`);
                break;

            case "value":
                setupLines.push(`  const ${varName} = generator.valueToCode(block, '${argName}', generator.ORDER_NONE) || '';`);
                codeFragments.push(`${varName} + ' '`);
                break;

            case "statement":
                setupLines.push(`  const ${varName} = generator.statementToCode(block, '${argName}');`);
                codeFragments.push(varName);
                break;

            default:
                throw new Error(`No code-generator template for IR part kind "${part.kind}"`);
        }
    }

    const codeExpr = codeFragments.length ? codeFragments.join(" + ") : `''`;

    return [
        `generator.forBlock['${blockType}'] = function (block: Blockly.Block): string {`,
        ...setupLines,
        `  return (${codeExpr});`,
        `};`
    ].join("\n");
}

/**
 * @param {import('./ir-builder.js').RuleIR[]} irRules
 * @returns {string} contents of generator.ts
 *
 * Default strategy: reconstruct the DSL's own concrete syntax from each
 * block's fields/inputs. Easy to hand-edit per block afterwards (e.g. to
 * emit real target code instead of round-tripping grammar text, as the
 * rbac_* generators do).
 */
export function generateGeneratorTs(irRules) {

    const functions = irRules.map(ruleToGeneratorFunction).join("\n\n");

    return `import * as Blockly from 'blockly';

import { javascriptGenerator } from 'blockly/javascript';
export const generator = javascriptGenerator;

generator.INDENT = '  ';

${functions}
`;
}

/**
 * @param {import('./ir-builder.js').RuleIR[]} irRules
 * @returns {string} contents of main.ts
 *
 * Generic workspace + toolbox + code/error output wiring. Deliberately
 * does not include a domain-specific evaluator (like the rbac_* example's
 * policy/role/action/resource selects) since that logic depends on the
 * meaning of your grammar, not just its shape - add that by hand once the
 * generated blocks are in place.
 */
export function generateMainTs(irRules) {

    const toolboxEntries = irRules
        .map(rule => `      { "kind": "block", "type": "${rule.name.toLowerCase()}" }`)
        .join(",\n");

    return `import * as Blockly from 'blockly';
import { defineBlocks } from './blocks';
import { generator } from './generator';

// define custom blocks before setting up the workspace
defineBlocks();

// set up the Blockly workspace
const workspace = Blockly.inject('blocklyDiv', {
  toolbox: {
    "kind": "flyoutToolbox",
    "contents": [
${toolboxEntries}
    ]
  }
});

// show code and errors
const codeOutput = document.getElementById('codeOutput');
const errorOutput = document.getElementById('errorOutput');

function generateCode() {
  try {
    const code = generator.workspaceToCode(workspace);
    if (codeOutput) codeOutput.textContent = code;
    if (errorOutput) errorOutput.textContent = '';
  } catch (e) {
    if (errorOutput) errorOutput.textContent = e instanceof Error ? e.message : String(e);
  }
}

// generate code whenever the workspace changes
workspace.addChangeListener(generateCode);
`;
}
