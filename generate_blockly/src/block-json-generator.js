/**
 * Registry mapping IR part "kind" -> Blockly arg0 builder. Extend this to
 * support new IR part kinds (e.g. a future "optional_value") without
 * touching ruleToBlockJson.
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
    }
};

function partToArg(part) {

    const builder = argBuilders[part.kind];

    if (!builder)
        throw new Error(`No block-json builder for IR part kind "${part.kind}"`);

    return builder(part);
}

function ruleToBlockJson(rule) {

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
        block.args0.push(partToArg(part));
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
    return irRules.map(ruleToBlockJson);
}

export { argBuilders };
