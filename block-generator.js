import {
    isParserRule,
    isKeyword,
    isAssignment,
    isGroup
} from './ast-utils.js';

export function generateBlocks(grammar) {

    const result = [];

    for (const rule of grammar.rules) {

        if (!isParserRule(rule))
            continue;

        result.push(generateBlock(rule));
    }

    return result;
}

function generateBlock(rule) {

    const block = {
        type: rule.name.toLowerCase(),
        message0: "",
        args0: [],
        previousStatement: null,
        nextStatement: null,
        colour: 230
    };

    let placeholder = 1;

    visit(rule.definition);

    return block;

    function visit(node) {

        if (!node)
            return;

        switch (node.$type) {

            case "Group":

                for (const e of node.elements)
                    visit(e);

                break;

            case "Keyword":

                block.message0 += node.value + " ";

                break;

            case "Assignment":

                addAssignment(node);

                break;

            case "Alternatives":

                for (const e of node.elements)
                    visit(e);

                break;
        }
    }

    function addAssignment(a) {

        block.message0 += `%${placeholder++} `;

        if (a.operator === "+=") {

            block.args0.push({
                type: "input_statement",
                name: a.feature
            });

            return;
        } 
        
        else if (a.terminal.$type === "RuleCall") {

            switch (a.terminal.rule.ref?.name) {

                case "ID":

                    block.args0.push({
                        type: "field_input",
                        name: a.feature,
                        text: ""
                    });

                    break;

                case "INT":

                    block.args0.push({
                        type: "field_number",
                        name: a.feature,
                        value: 0
                    });

                    break;

                default:

                    block.args0.push({
                        type: "input_value",
                        name: a.feature
                    });
            }
        }
        else if (a.terminal.$type === "Alternatives") {

            const options = [];

            let allKeywords = true;

            for (const e of a.terminal.elements) {

                if (e.$type !== "Keyword") {
                    allKeywords = false;
                    break;
                }

                options.push([e.value, e.value]);
            }

            if (allKeywords) {

                block.args0.push({
                    type: "field_dropdown",
                    name: a.feature,
                    options
                });

                return;
            }
        }

        else {

            block.args0.push({
                type: "input_value",
                name: a.feature
            });
        }
    }
}