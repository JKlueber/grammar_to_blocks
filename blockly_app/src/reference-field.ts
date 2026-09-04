import * as Blockly from 'blockly';

/**
 * FieldReference - a dropdown field for Langium cross-references
 * (`feature=[TargetRule:TERMINAL]`, e.g. `assignee=[Member:ID]`).
 *
 * THIS FILE IS STATIC. Unlike blocks.ts / generator.ts / main.ts, it is
 * NOT overwritten when you re-run `parse.js` - it's hand-maintained
 * infrastructure, the same way index.html is. The generated blocks.ts
 * just imports it (for its registration side effect below) so that any
 * "reference" IR part which resolved to a field_reference (see
 * argBuilders.reference in generate_blockly/src/block-json-generator.js)
 * has somewhere to find that field type.
 *
 * WHY A CUSTOM FIELD AT ALL: a plain field_dropdown's option list is
 * fixed at block-definition time. A cross-reference's valid options are
 * exactly "the names of every currently-declared block of the target
 * rule" - which changes as the user adds, removes, or renames blocks on
 * the workspace. So instead of a static option list, FieldReference
 * overrides getOptions() to compute that list fresh, every time the
 * dropdown is opened, by scanning the live workspace. This means a
 * cross-reference field can only ever point at something that actually
 * exists right now - no more free-text typos that don't match anything.
 *
 * Block JSON usage (emitted by argBuilders.reference):
 *   {
 *     "type": "field_reference",
 *     "name": "ASSIGNEE",
 *     "referencesType": "member",  // lowercase Blockly block type to scan for
 *     "nameField": "NAME"          // arg name on that block type holding its name
 *   }
 *
 * LIMITATIONS (kept deliberately simple - see README.md's "Cross-reference
 * strategies" discussion for heavier alternatives):
 *   - Only rules with a plain `feature=ID` "name" field are scannable -
 *     see findNameField() in ir-builder.js. Rules without one fall back
 *     to the old free-text field_input instead of field_reference.
 *   - No scoping: every block of the target type on the whole workspace
 *     is offered, regardless of where the referencing block sits. Real
 *     Langium cross-references can be scope-restricted; this field
 *     treats every declared name as globally visible.
 *   - If the block whose name is currently selected gets renamed or
 *     deleted, the field's stored value simply stops matching any live
 *     option; Blockly will fall back to the first available option the
 *     next time the dropdown is opened. Nothing actively repairs or
 *     flags a now-dangling reference.
 */
export class FieldReference extends Blockly.FieldDropdown {

    private referencesType: string;
    private nameField: string;

    constructor(referencesType: string, nameField: string) {
        // FieldDropdown's constructor needs *some* menu generator up
        // front, even though we're about to replace how options are
        // computed via getOptions() below. We can't pass an arrow
        // function that reads `this` here (this isn't initialized until
        // after super() returns in a derived class), so we hand it a
        // harmless static placeholder instead - it's never actually
        // shown, since getOptions() is what Blockly calls whenever it
        // needs the real list.
        super([['', '']]);
        this.referencesType = referencesType;
        this.nameField = nameField;
    }

    /**
     * Called by Blockly.fieldRegistry when a block's JSON definition
     * requests `"type": "field_reference"`. Reads the two extra config
     * keys emitted by argBuilders.reference (block-json-generator.js).
     *
     * Typed as `any` rather than a precise `{ referencesType, nameField }`
     * shape: Blockly's own `FieldDropdown.fromJson` static signature takes
     * its stricter built-in `FieldDropdownFromJsonConfig`, and TypeScript
     * requires a subclass's static `fromJson` parameter type to still
     * accept whatever the base class's does. `any` satisfies that without
     * fighting Blockly's field-registry typings for a two-field object.
     */
    static fromJson(options: any): FieldReference {
        return new FieldReference(options.referencesType, options.nameField);
    }

    /**
     * Overrides FieldDropdown's normal (static) option lookup. Scans
     * every block currently on the workspace, keeps the ones matching
     * `referencesType`, and reads each one's `nameField` to build the
     * live list of "things you could point this reference at right now".
     *
     * Falls back to a single disabled-looking placeholder option when
     * nothing is declared yet, since FieldDropdown requires at least one
     * option to exist at all times.
     */
    override getOptions(_useCache?: boolean): Blockly.MenuOption[] {
        const workspace = this.getSourceBlock()?.workspace;

        if (!workspace) {
            return [['(no workspace)', '']];
        }

        const names = new Set<string>();
        for (const block of workspace.getAllBlocks(false)) {
            if (block.type !== this.referencesType)
                continue;

            const name = block.getFieldValue(this.nameField);
            if (name)
                names.add(name);
        }

        if (names.size === 0) {
            return [[`(no ${this.referencesType} declared)`, '']];
        }

        return [...names].sort().map(name => [name, name] as [string, string]);
    }
}

// Registers "field_reference" as a JSON-loadable field type, the same
// way Blockly's own built-ins (field_input, field_dropdown, ...) are
// registered internally. After this runs once, any block JSON with
// `{ "type": "field_reference", ... }` resolves to this class.
Blockly.fieldRegistry.register('field_reference', FieldReference);
