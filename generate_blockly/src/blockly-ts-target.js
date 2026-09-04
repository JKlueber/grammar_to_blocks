import { argBuilders } from './block-json-generator.js';
import { computeNameFields } from './ir-builder.js';

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

function computeValueRules(irRules, stackTypes) {
    const valueRules = new Set();
    for (const rule of irRules) {
        for (const part of rule.parts) {
            if (part.kind === "value" && part.refRuleName) {
                const refLower = part.refRuleName.toLowerCase();
                if (!stackTypes.has(refLower)) {
                    valueRules.add(refLower);
                }
            }
        }
    }
    return valueRules;
}

function humanizeFeature(feature) {
    if (/^anon\d+$/.test(feature))
        return "Option";

    return feature
        .split("_")
        .map(word => word.replace(/([a-z0-9])([A-Z])/g, "$1 $2"))
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" / ");
}

function colourForRule(name) {
    let hash = 0;
    for (const ch of name)
        hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return hash % 360;
}

function partToArg(part, stackTypes, valueRules, nameFields) {
    if (part.kind === "value" && part.refRuleName) {
        const refLower = part.refRuleName.toLowerCase();
        if (!valueRules.has(refLower)) {
            return {
                type: "field_input",
                name: toArgName(part.feature),
                text: "default_" + part.feature
            };
        }
    }

    const builder = argBuilders[part.kind];

    if (!builder)
        throw new Error(`No block-json builder for IR part kind "${part.kind}"`);

    // nameFields is only read by argBuilders.reference (see
    // block-json-generator.js); every other builder ignores the extra
    // argument, same as in that file's own partToArg.
    const arg = { ...builder(part, nameFields), name: toArgName(part.feature) };

    // argBuilders.reference (block-json-generator.js) returns nameField
    // as the *raw* feature name (e.g. "name"), because that's what its
    // own args use unconverted. This target, unlike that one, upper-snake
    // -cases every arg name (see toArgName above and block[NAME] JSON
    // just built for the target rule's own field) - so the raw feature
    // name has to go through the same conversion here, or field_reference
    // would call block.getFieldValue() with a name that doesn't exist on
    // the target block, and the dropdown would always look empty.
    if (arg.type === "field_reference" && arg.nameField) {
        arg.nameField = toArgName(arg.nameField);
    }

    // Provide helpful default text for plain text fields so generated
    // code is never empty. This covers "field" text inputs and the
    // text-field *fallback* a "reference" part gets when its target rule
    // has no name to build a dropdown from (see argBuilders.reference in
    // block-json-generator.js). A "reference" part that resolved to the
    // dynamic field_reference field is skipped here - that field type
    // has no "text" default, it picks its first live option instead.
    if (arg.type === "field_input" && !arg.text) {
        arg.text = part.kind === "reference"
            ? "target_" + part.feature
            : "Unnamed";
    }

    if (part.kind === "statement") {
        const names = (part.refRuleNames?.length ? part.refRuleNames : (part.refRuleName ? [part.refRuleName] : []))
            .map(n => n.toLowerCase());

        const checks = [...new Set(names.map(n => stackTypes.get(n)))].filter(Boolean);

        if (checks.length)
            arg.check = checks.length === 1 ? checks[0] : checks;
    } else if (part.kind === "value" && part.refRuleName) {
        arg.check = part.refRuleName.toLowerCase();
    }

    // NOTE: "reference" parts (cross-references) deliberately get no
    // `arg.check`, whether they render as the dynamic field_reference or
    // the plain-text fallback. A "check" type is Blockly's
    // plug-compatibility rule for *nested* value blocks; a reference
    // isn't nesting another block, it's naming one - via a live-scanned
    // dropdown or typed text - so there's nothing to type-check at the
    // Blockly connection level.

    return arg;
}

function ruleToBlockJson(rule, stackTypes, valueRules, nameFields) {
    const block = { type: rule.name.toLowerCase() };
    const ruleLower = rule.name.toLowerCase();

    let messageIndex = 0;
    let currentMsg = [];
    let currentArgs = [];
    let placeholder = 1;

    const flushLine = () => {
        const msgStr = currentMsg.join(" ").trim();
        if (msgStr.length > 0 || currentArgs.length > 0) {
            block[`message${messageIndex}`] = msgStr;
            if (currentArgs.length > 0) {
                block[`args${messageIndex}`] = currentArgs;
            }
            messageIndex++;
            currentMsg = [];
            currentArgs = [];
            placeholder = 1;
        }
    };

    for (const part of rule.parts) {
        if (part.kind === "keyword") {
            if (part.text === "{" || part.text === "}") {
                flushLine();
                currentMsg.push(part.text);
                flushLine();
            } else {
                currentMsg.push(part.text);
            }
            continue;
        }

        if (part.kind === "statement") {
            flushLine();
            block[`message${messageIndex}`] = `${humanizeFeature(part.feature)}: %1`;
            block[`args${messageIndex}`] = [partToArg(part, stackTypes, valueRules, nameFields)];
            messageIndex++;
            continue;
        }

        currentMsg.push(`${humanizeFeature(part.feature)}: %${placeholder++}`);
        currentArgs.push(partToArg(part, stackTypes, valueRules, nameFields));
    }

    flushLine();

    block.colour = colourForRule(rule.name);

    if (valueRules.has(ruleLower)) {
        block.output = ruleLower;
    } else {
        const stackType = stackTypes.get(ruleLower);
        if (stackType) {
            block.previousStatement = stackType;
            block.nextStatement = stackType;
        } else {
            block.previousStatement = null;
            block.nextStatement = null;
        }
    }

    return block;
}

export function generateBlocksTs(irRules) {
    const stackTypes = computeStackTypes(irRules);
    const valueRules = computeValueRules(irRules, stackTypes);
    const nameFields = computeNameFields(irRules);
    const blocks = irRules.map(rule => ruleToBlockJson(rule, stackTypes, valueRules, nameFields));
    const blocksLiteral = indent(JSON.stringify(blocks, null, 2), 4);

    // './reference-field' is a static, hand-maintained module (not
    // regenerated by this pipeline - see blockly_app/src/reference-field.ts)
    // that defines and registers the custom `field_reference` field used
    // by any cross-reference part above that resolved to a live dropdown
    // (see argBuilders.reference in block-json-generator.js). It's
    // imported here purely for its registration side effect, so the
    // field type exists before Blockly ever tries to render a block that
    // uses it. Importing it is harmless even for grammars with no
    // cross-references at all.
    return `import * as Blockly from 'blockly';
import './reference-field';

export function defineBlocks() {
  Blockly.defineBlocksWithJsonArray(
${blocksLiteral}
  );
}
`;
}

function ruleToGeneratorFunction(rule, stackTypes, valueRules) {
    const blockType = rule.name.toLowerCase();
    const isValueBlock = valueRules.has(blockType);
    const setupLines = [];
    const items = [];

    for (const part of rule.parts) {
        if (part.kind === "keyword") {
            items.push({ frag: JSON.stringify(part.text), multiline: false });
            continue;
        }

        const varName = safeVarName(part.feature);
        const argName = toArgName(part.feature);
        const isConvertedValueField = part.kind === "value" && part.refRuleName && !valueRules.has(part.refRuleName.toLowerCase());

        // "field" (ID/INT text/number inputs), "dropdown", a "value" part
        // that got converted to a plain text field (no matching value
        // block exists), and "reference" (cross-reference) parts are all
        // backed by a single Blockly field, so they're all read back the
        // same way via getFieldValue - a cross-reference's field just
        // happens to hold the referenced element's name as plain text,
        // which is exactly what the original DSL syntax expects there.
        if (part.kind === "field" || part.kind === "dropdown" || part.kind === "reference" || isConvertedValueField) {
            setupLines.push(`  const ${varName} = block.getFieldValue('${argName}') || 'Unnamed';`);
            items.push({ frag: varName, multiline: false });
        } else if (part.kind === "value") {
            setupLines.push(`  const ${varName} = generator.valueToCode(block, '${argName}', generator.ORDER_NONE) || '';`);
            items.push({ frag: varName, multiline: false });
        } else if (part.kind === "statement") {
            const raw = `generator.statementToCode(block, '${argName}').replace(/\\n$/, '')`;
            setupLines.push(`  const ${varName} = ${raw};`);
            items.push({ frag: varName, multiline: true });
        } else {
            throw new Error(`No code-generator template for IR part kind "${part.kind}"`);
        }
    }

    let codeExpr;
    if (!items.length) {
        codeExpr = `''`;
    } else {
        codeExpr = items[0].frag;
        for (let i = 1; i < items.length; i++) {
            const sep = (items[i - 1].multiline || items[i].multiline) ? "'\\n'" : "' '";
            codeExpr += ` + ${sep} + ${items[i].frag}`;
        }
    }

    const isStackable = stackTypes.has(blockType);

    if (isValueBlock) {
        return [
            `generator.forBlock['${blockType}'] = function (block: Blockly.Block) {`,
            ...setupLines,
            `  const code = (${codeExpr}).trim();`,
            `  return [code, generator.ORDER_ATOMIC];`,
            `};`
        ].join("\n");
    } else {
        return [
            `generator.forBlock['${blockType}'] = function (block: Blockly.Block): string {`,
            ...setupLines,
            `  const code = (${codeExpr}).trim();`,
            `  return code${isStackable ? " + '\\n'" : ""};`,
            `};`
        ].join("\n");
    }
}

export function generateGeneratorTs(irRules) {
    const stackTypes = computeStackTypes(irRules);
    const valueRules = computeValueRules(irRules, stackTypes);
    const functions = irRules.map(rule => ruleToGeneratorFunction(rule, stackTypes, valueRules)).join("\n\n");

    return `import * as Blockly from 'blockly';

import { javascriptGenerator } from 'blockly/javascript';
export const generator = javascriptGenerator;

generator.INDENT = '  ';

function dedentOnce(code: string): string {
  return code
    .split('\\n')
    .map(line => line.startsWith(generator.INDENT) ? line.slice(generator.INDENT.length) : line)
    .join('\\n');
}

${functions}
`;
}

export function generateMainTs(irRules) {
    const toolboxCategories = [];
    const entryRules = irRules.filter(r => r.entry);
    const otherRules = irRules.filter(r => !r.entry);

    if (entryRules.length) {
        toolboxCategories.push({
            name: "Main / Entry",
            colour: "210",
            blocks: entryRules.map(r => r.name.toLowerCase())
        });
    }

    if (otherRules.length) {
        toolboxCategories.push({
            name: "Elements & Components",
            colour: "160",
            blocks: otherRules.map(r => r.name.toLowerCase())
        });
    }

    const toolboxJson = {
        kind: "categoryToolbox",
        contents: toolboxCategories.map(cat => ({
            kind: "category",
            name: cat.name,
            colour: cat.colour,
            contents: cat.blocks.map(type => ({ kind: "block", type }))
        }))
    };

    return `import * as Blockly from 'blockly';
import { defineBlocks } from './blocks';
import { generator } from './generator';

defineBlocks();

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: ${JSON.stringify(toolboxJson, null, 2)}
});

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

workspace.addChangeListener(generateCode);
`;
}
