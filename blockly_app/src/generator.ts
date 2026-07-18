import * as Blockly from 'blockly';

import { javascriptGenerator } from 'blockly/javascript';
export const generator = javascriptGenerator;

generator.INDENT = '  ';

// TODO refine the generated code-generation logic below as needed.
// https://developers.google.com/blockly/guides/create-custom-blocks/generating-code

generator.forBlock['program'] = function (block: Blockly.Block): string {
  const commands = generator.statementToCode(block, 'COMMANDS');
  return (commands);
};

generator.forBlock['command'] = function (block: Blockly.Block): string {
  const label = block.getFieldValue('LABEL');
  const direction = block.getFieldValue('DIRECTION');
  const distance = generator.valueToCode(block, 'DISTANCE', generator.ORDER_NONE) || '';
  return ("move " + label + ' ' + direction + ' ' + distance + ' ');
};

generator.forBlock['amount'] = function (block: Blockly.Block): string {
  const value = block.getFieldValue('VALUE');
  return (value + ' ');
};
