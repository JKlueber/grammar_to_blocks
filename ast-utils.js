export function isParserRule(rule) {
    return rule.$type === "ParserRule";
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