// Generates a synthetic - but fully valid, within-the-supported-subset -
// .langium grammar with `ruleCount` independent rules, all gathered under
// one entry rule. Used by performance.js to answer "how does each
// pipeline stage scale as a grammar grows?" with something more
// systematic than eyeballing the (small, fixed-size) bundled examples.
//
// Each generated rule looks like:
//   Rule7:
//       'kw7' name=ID value=INT choice=('a' | 'b' | 'c');
// and the entry rule stacks one repeated statement input per rule:
//   entry Root:
//       'root' '{' items0+=Rule0* items1+=Rule1* ... '}';
//
// This exercises every non-trivial IR part kind used by the bundled
// examples (keyword, field [text + number], dropdown, statement) at
// whatever scale is requested, without needing cross-references or merged
// alternatives (which don't meaningfully change with N).
export function generateSyntheticGrammar(ruleCount) {
    if (!Number.isInteger(ruleCount) || ruleCount < 1) {
        throw new Error(`ruleCount must be a positive integer, got ${ruleCount}`);
    }

    const statementLines = [];
    const ruleDefs = [];

    for (let i = 0; i < ruleCount; i++) {
        statementLines.push(`        items${i}+=Rule${i}*`);
        ruleDefs.push(
            `Rule${i}:\n` +
            `    'kw${i}' name=ID value=INT choice=('a' | 'b' | 'c');`
        );
    }

    return `grammar Synthetic${ruleCount}

entry Root:
    'root' '{'
${statementLines.join('\n')}
    '}';

${ruleDefs.join('\n\n')}

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal INT returns number: /[0-9]+/;
hidden terminal WS: /\\s+/;
`;
}
