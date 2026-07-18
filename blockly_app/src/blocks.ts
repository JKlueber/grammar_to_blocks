import * as Blockly from 'blockly';

// Export a function to define our blocks
export function defineBlocks() {
  Blockly.defineBlocksWithJsonArray(
    [
      {
        "type": "program",
        "message0": "%1",
        "args0": [
          {
            "type": "input_statement",
            "name": "COMMANDS"
          }
        ],
        "previousStatement": null,
        "nextStatement": null
      },
      {
        "type": "command",
        "message0": "move %1 %2 %3",
        "args0": [
          {
            "type": "field_input",
            "name": "LABEL",
            "text": ""
          },
          {
            "type": "field_dropdown",
            "name": "DIRECTION",
            "options": [
              [
                "forward",
                "forward"
              ],
              [
                "backward",
                "backward"
              ],
              [
                "left",
                "left"
              ],
              [
                "right",
                "right"
              ]
            ]
          },
          {
            "type": "input_value",
            "name": "DISTANCE"
          }
        ],
        "previousStatement": "command",
        "nextStatement": "command"
      },
      {
        "type": "amount",
        "message0": "%1",
        "args0": [
          {
            "type": "field_number",
            "name": "VALUE",
            "value": 0
          }
        ],
        "previousStatement": null,
        "nextStatement": null
      }
    ]
  );
}
