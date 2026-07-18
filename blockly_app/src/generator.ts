import * as Blockly from 'blockly';

import { javascriptGenerator } from 'blockly/javascript';
export const generator = javascriptGenerator;

generator.INDENT = '  ';

generator.forBlock['addressbook'] = function (block: Blockly.Block): string {
  const contacts = generator.statementToCode(block, 'CONTACTS');
  return (contacts);
};

generator.forBlock['contact'] = function (block: Blockly.Block): string {
  const name = block.getFieldValue('NAME');
  const phones_addresses = generator.statementToCode(block, 'PHONES_ADDRESSES');
  return ("contact " + name + ' ' + "{ " + phones_addresses + "} ");
};

generator.forBlock['phone'] = function (block: Blockly.Block): string {
  const number = block.getFieldValue('NUMBER');
  return ("phone " + number + ' ');
};

generator.forBlock['address'] = function (block: Blockly.Block): string {
  const city = block.getFieldValue('CITY');
  return ("address " + city + ' ');
};
