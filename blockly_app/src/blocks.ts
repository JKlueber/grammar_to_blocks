import * as Blockly from 'blockly';

export function defineBlocks() {
  Blockly.defineBlocksWithJsonArray(
    [
      {
        "type": "cookbook",
        "message0": "recipe Name: %1",
        "args0": [
          {
            "type": "field_input",
            "name": "NAME",
            "text": "Unnamed"
          }
        ],
        "message1": "{",
        "message2": "Ingredients: %1",
        "args2": [
          {
            "type": "input_statement",
            "name": "INGREDIENTS",
            "check": "ingredient"
          }
        ],
        "message3": "Steps: %1",
        "args3": [
          {
            "type": "input_statement",
            "name": "STEPS",
            "check": "step"
          }
        ],
        "message4": "}",
        "colour": 41,
        "previousStatement": null,
        "nextStatement": null
      },
      {
        "type": "ingredient",
        "message0": "ingredient Name: %1 Amount: %2",
        "args0": [
          {
            "type": "field_input",
            "name": "NAME",
            "text": "Unnamed"
          },
          {
            "type": "field_number",
            "name": "AMOUNT",
            "value": 0
          }
        ],
        "colour": 121,
        "previousStatement": "ingredient",
        "nextStatement": "ingredient"
      },
      {
        "type": "step",
        "message0": "step Number: %1 Action: %2 Ingredient: %3",
        "args0": [
          {
            "type": "field_number",
            "name": "NUMBER",
            "value": 0
          },
          {
            "type": "field_dropdown",
            "name": "ACTION",
            "options": [
              [
                "add",
                "add"
              ],
              [
                "mix",
                "mix"
              ],
              [
                "cook",
                "cook"
              ],
              [
                "serve",
                "serve"
              ]
            ]
          },
          {
            "type": "field_input",
            "name": "INGREDIENT",
            "text": "target_ingredient"
          }
        ],
        "colour": 52,
        "previousStatement": "step",
        "nextStatement": "step"
      }
    ]
  );
}
