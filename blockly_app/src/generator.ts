import * as Blockly from 'blockly';

import { javascriptGenerator } from 'blockly/javascript';
export const generator = javascriptGenerator;

generator.INDENT = '  ';

// TODO refine the generated code-generation logic below as needed.
// https://developers.google.com/blockly/guides/create-custom-blocks/generating-code

generator.forBlock['addressbook'] = function (block: Blockly.Block): string {
  const contacts = generator.statementToCode(block, 'CONTACTS');
  return (contacts);
};

generator.forBlock['contact'] = function (block: Blockly.Block): string {
  const name = block.getFieldValue('NAME');
  const phones = generator.statementToCode(block, 'PHONES');
  return ("contact " + name + ' ' + "{ " + phones + "} ");
};

generator.forBlock['phone'] = function (block: Blockly.Block): string {
  const number = block.getFieldValue('NUMBER');
  return ("phone " + number + ' ');
};

generator.forBlock['address'] = function (block: Blockly.Block): string {
  const city = block.getFieldValue('CITY');
  return ("address " + city + ' ');
};
