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
 * Rule names that appear as the target of a `+=` list somewhere in the
 * grammar. Their blocks get a self-typed previousStatement/nextStatement
 * so instances of them stack onto each other - the same pattern used by
 * rbac_role / rbac_rule / rbac_resource in the hand-written template.
 */
function computeStackableRuleNames(irRules) {

    const stackable = new Set();

    for (const rule of irRules)
        for (const part of rule.parts)
            if (part.kind === "statement" && part.refRuleName)
                stackable.add(part.refRuleName.toLowerCase());

    return stackable;
}

function partToArg(part) {

    const builder = argBuilders[part.kind];

    if (!builder)
        throw new Error(`No block-json builder for IR part kind "${part.kind}"`);

    return { ...builder(part), name: toArgName(part.feature) };
}

function ruleToBlockJson(rule, stackableRuleNames) {

    const block = { type: rule.name.toLowerCase(), message0: "", args0: [] };

    let placeholder = 1;

    for (const part of rule.parts) {

        if (part.kind === "keyword") {
            block.message0 += part.text + " ";
            continue;
        }

        block.message0 += `%${placeholder++} `;
        block.args0.push(partToArg(part));
    }

    block.message0 = block.message0.trim();

    if (stackableRuleNames.has(rule.name.toLowerCase())) {
        block.previousStatement = block.type;
        block.nextStatement = block.type;
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

    const stackable = computeStackableRuleNames(irRules);
    const blocks = irRules.map(rule => ruleToBlockJson(rule, stackable));
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

// TODO refine the generated code-generation logic below as needed.
// https://developers.google.com/blockly/guides/create-custom-blocks/generating-code

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
