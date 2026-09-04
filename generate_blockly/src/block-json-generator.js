import { computeNameFields } from './ir-builder.js';

/**
 * Standalone RuleIR[] -> Blockly JSON generator.
 *
 * NOT called by generate_blockly/src/parse.js. The CLI pipeline uses
 * blockly-ts-target.js's generateBlocksTs() instead, which reuses the
 * `argBuilders` registry from this file but adds the extra bits that
 * pipeline needs (upper-snake-cased arg names, per-rule colours, and the
 * "check" typing that lets rules in a merged `+=` statement input stack
 * together - see the RuleIR.refRuleNames doc in ir-builder.js).
 *
 * Kept here as a lighter-weight option for anyone who wants plain Blockly
 * JSON (for `Blockly.defineBlocksWithJsonArray(...)`) without the rest of
 * the TypeScript/generator/main scaffolding blockly-ts-target.js produces.
 */

/**
 * Registry mapping IR part "kind" -> Blockly arg0 builder. Extend this to
 * support new IR part kinds (e.g. a future "optional_value") without
 * touching ruleToBlockJson.
 *
 * Every builder is called as `builder(part, nameFields)`. Only
 * `reference` currently reads the second argument (see below); the
 * others ignore it, but it's passed uniformly so partToArg doesn't need
 * to special-case any one kind.
 */
const argBuilders = {

    field(part) {
        return part.fieldType === "number"
            ? { type: "field_number", name: part.feature, value: 0 }
            : { type: "field_input", name: part.feature, text: "" };
    },

    dropdown(part) {
        return { type: "field_dropdown", name: part.feature, options: part.options };
    },

    value(part) {
        return { type: "input_value", name: part.feature };
    },

    statement(part) {
        return { type: "input_statement", name: part.feature };
    },

    /**
     * Cross-references (`feature=[TargetRule:TERMINAL]`) render as a
     * dynamic dropdown, backed by the custom `field_reference` field
     * (defined in blockly_app/src/reference-field.ts - see that file for
     * the actual live-scanning logic). Instead of typing the target's
     * name as free text, the field scans the current workspace for every
     * block of type `referencesType` and offers each one's declared name
     * (read from its `nameField`) as an option - so a reference can only
     * ever point at something that currently exists.
     *
     * `nameFields` (built once per generation run by
     * ir-builder.js#computeNameFields) tells us which arg on the *target*
     * rule holds its name. If the target rule has no such field, there's
     * nothing to scan for and we fall back to the old plain text field -
     * this keeps the pipeline from crashing on grammars where the
     * referenced rule doesn't happen to declare a name via `feature=ID`.
     */
    reference(part, nameFields) {
        const nameField = part.refRuleName && nameFields?.get(part.refRuleName.toLowerCase());

        if (!nameField) {
            return { type: "field_input", name: part.feature, text: "" };
        }

        return {
            type: "field_reference",
            name: part.feature,
            referencesType: part.refRuleName.toLowerCase(),
            nameField
        };
    }
};

function partToArg(part, nameFields) {

    const builder = argBuilders[part.kind];

    if (!builder)
        throw new Error(`No block-json builder for IR part kind "${part.kind}"`);

    return builder(part, nameFields);
}

function ruleToBlockJson(rule, nameFields) {

    const block = {
        type: rule.name.toLowerCase(),
        message0: "",
        args0: [],
        previousStatement: null,
        nextStatement: null,
        colour: 230
    };

    let placeholder = 1;

    for (const part of rule.parts) {

        if (part.kind === "keyword") {
            block.message0 += part.text + " ";
            continue;
        }

        // NOTE: `optional`/`repeatable` flags on non-keyword parts aren't
        // reflected in the JSON yet (plain Blockly JSON has no native
        // "optional input" concept). A future version could turn
        // `optional: true` parts into a mutator that toggles the input.
        block.message0 += `%${placeholder++} `;
        block.args0.push(partToArg(part, nameFields));
    }

    block.message0 = block.message0.trim();

    return block;
}

/**
 * @param {import('./ir-builder.js').RuleIR[]} irRules
 * @returns {object[]} Blockly block JSON definitions, ready for
 *   `Blockly.defineBlocksWithJsonArray(blocks)`.
 */
export function generateBlockJson(irRules) {
    const nameFields = computeNameFields(irRules);
    return irRules.map(rule => ruleToBlockJson(rule, nameFields));
}

export { argBuilders };
