export function isParserRule(rule) {
    return rule.$type === "ParserRule";
}

export function isTerminalRule(rule) {
    return rule.$type === "TerminalRule";
}

export function isKeyword(node) {
    return node.$type === "Keyword";
}

export function isAssignment(node) {
    return node.$type === "Assignment";
}

export function isGroup(node) {
    return node.$type === "Group";
}

export function isAlternatives(node) {
    return node.$type === "Alternatives";
}

export function isRuleCall(node) {
    return node.$type === "RuleCall";
}

// UnorderedGroup nodes are Langium's `&` operator (e.g. `a=ID & b=ID`) -
// part of the supported subset (see validator.js's DEFAULT_ALLOWED_TYPES
// and ir-builder.js's UnorderedGroup handler). Blockly's block UI has no
// native "any order" input, so it's walked/visited exactly like a plain
// Group: elements are always emitted and read back in declaration order,
// not enforced by the grammar itself.
export function isUnorderedGroup(node) {
    return node.$type === "UnorderedGroup";
}

// CrossReference nodes are Langium's `feature=[TargetRule:TERMINAL]` syntax
// (e.g. `assignee=[Member:ID]`) - "refer to another element by the name it
// was declared with" rather than nesting/plugging a value in directly. This
// predicate is used by the validator (to allow the node type) and by the
// IR builder (see nodeHandlers.CrossReference / the CrossReference branch
// of handleAssignment in ir-builder.js) to turn it into a "reference" IR
// part.
export function isCrossReference(node) {
    return node.$type === "CrossReference";
}

export function isAction(node) {
    return node.$type === "Action";
}

/**
 * Langium encodes repetition ("?", "*", "+") as a `cardinality` property
 * on the node it applies to. Centralised here so every module reads it
 * the same way.
 */
export function getCardinality(node) {
    return node?.cardinality ?? null;
}
