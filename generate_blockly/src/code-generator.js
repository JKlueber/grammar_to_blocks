/**
 * Registry mapping IR part "kind" -> a builder that returns
 * { setupLine, codeFragment } for that part, used when assembling a
 * block's generator function. Extend this to change how a given kind of
 * input is turned into generated code.
 */
const partTemplates = {

    keyword(part) {
        return { setupLine: null, codeFragment: JSON.stringify(part.text + " ") };
    },

    field(part) {
        const v = safeVarName(part.feature);
        return {
            setupLine: `    const ${v} = block.getFieldValue(${JSON.stringify(part.feature)});`,
            codeFragment: `${v} + " "`
        };
    },

    dropdown(part) {
        const v = safeVarName(part.feature);
        return {
            setupLine: `    const ${v} = block.getFieldValue(${JSON.stringify(part.feature)});`,
            codeFragment: `${v} + " "`
        };
    },

    value(part) {
        const v = safeVarName(part.feature);
        return {
            setupLine: `    const ${v} = generator.valueToCode(block, ${JSON.stringify(part.feature)}, generator.ORDER_NONE) || '';`,
            codeFragment: `${v} + " "`
        };
    },

    statement(part) {
        const v = safeVarName(part.feature);
        return {
            setupLine: `    const ${v} = generator.statementToCode(block, ${JSON.stringify(part.feature)});`,
            codeFragment: `${v}`
        };
    }
};

function safeVarName(feature) {
    return feature.replace(/[^a-zA-Z0-9_]/g, "_");
}

function ruleToGeneratorFunction(rule, generatorName) {

    const blockType = rule.name.toLowerCase();

    const setupLines = [];
    const codeFragments = [];

    for (const part of rule.parts) {

        const template = partTemplates[part.kind];

        if (!template)
            throw new Error(`No code-generator template for IR part kind "${part.kind}"`);

        const { setupLine, codeFragment } = template(part);

        if (setupLine)
            setupLines.push(setupLine);

        codeFragments.push(codeFragment);
    }

    const codeExpr = codeFragments.length ? codeFragments.join(" + ") : `""`;

    return [
        `${generatorName}.forBlock[${JSON.stringify(blockType)}] = function (block, generator) {`,
        ...setupLines,
        `    const code = (${codeExpr}).trim();`,
        `    return code + "\\n";`,
        `};`
    ].join("\n");
}

/**
 * @param {import('./ir-builder.js').RuleIR[]} irRules
 * @param {object} [options]
 * @param {string} [options.generatorName] - e.g. "Blockly.JavaScript" or
 *   "javascriptGenerator" depending on how the caller's Blockly generator
 *   instance is named/imported.
 * @returns {string} JS source defining one `forBlock` entry per rule.
 */
export function generateCodeGenerators(irRules, options = {}) {

    const generatorName = options.generatorName ?? "Blockly.JavaScript";

    return irRules
        .map(rule => ruleToGeneratorFunction(rule, generatorName))
        .join("\n\n") + "\n";
}

export { partTemplates };
