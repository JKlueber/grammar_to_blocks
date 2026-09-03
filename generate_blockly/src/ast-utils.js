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

// Not part of the restricted subset yet, but named here so the validator
// and IR builder can reference it without guessing string literals when
// support is added later.
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
