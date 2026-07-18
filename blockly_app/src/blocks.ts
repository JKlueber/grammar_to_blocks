import * as Blockly from 'blockly';

// Export a function to define our blocks
export function defineBlocks() {
  Blockly.defineBlocksWithJsonArray(
    [
      {
        "type": "addressbook",
        "message0": "%1",
        "args0": [
          {
            "type": "input_statement",
            "name": "CONTACTS"
          }
        ],
        "previousStatement": null,
        "nextStatement": null
      },
      {
        "type": "contact",
        "message0": "contact %1 { %2 }",
        "args0": [
          {
            "type": "field_input",
            "name": "NAME",
            "text": ""
          },
          {
            "type": "input_statement",
            "name": "PHONES"
          }
        ],
        "previousStatement": "contact",
        "nextStatement": "contact"
      },
      {
        "type": "phone",
        "message0": "phone %1",
        "args0": [
          {
            "type": "field_number",
            "name": "NUMBER",
            "value": 0
          }
        ],
        "previousStatement": "phone",
        "nextStatement": "phone"
      },
      {
        "type": "address",
        "message0": "address %1",
        "args0": [
          {
            "type": "field_input",
            "name": "CITY",
            "text": ""
          }
        ],
        "previousStatement": null,
        "nextStatement": null
      }
    ]
  );
}
