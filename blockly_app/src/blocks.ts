import * as Blockly from 'blockly';

export function defineBlocks() {
  Blockly.defineBlocksWithJsonArray(
    [
      {
        "type": "addressbook",
        "message0": "Contacts: %1",
        "args0": [
          {
            "type": "input_statement",
            "name": "CONTACTS",
            "check": "contact"
          }
        ],
        "colour": 317,
        "previousStatement": null,
        "nextStatement": null
      },
      {
        "type": "contact",
        "message0": "contact Name: %1 { Phones / Addresses: %2 }",
        "args0": [
          {
            "type": "field_input",
            "name": "NAME",
            "text": ""
          },
          {
            "type": "input_statement",
            "name": "PHONES_ADDRESSES",
            "check": "address_or_phone"
          }
        ],
        "colour": 312,
        "previousStatement": "contact",
        "nextStatement": "contact"
      },
      {
        "type": "phone",
        "message0": "phone Number: %1",
        "args0": [
          {
            "type": "field_number",
            "name": "NUMBER",
            "value": 0
          }
        ],
        "colour": 86,
        "previousStatement": "address_or_phone",
        "nextStatement": "address_or_phone"
      },
      {
        "type": "address",
        "message0": "address City: %1",
        "args0": [
          {
            "type": "field_input",
            "name": "CITY",
            "text": ""
          }
        ],
        "colour": 156,
        "previousStatement": "address_or_phone",
        "nextStatement": "address_or_phone"
      }
    ]
  );
}
