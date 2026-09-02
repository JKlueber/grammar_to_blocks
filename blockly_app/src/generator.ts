import * as Blockly from 'blockly';

import { javascriptGenerator } from 'blockly/javascript';
export const generator = javascriptGenerator;

generator.INDENT = '  ';

function dedentOnce(code: string): string {
  return code
    .split('\n')
    .map(line => line.startsWith(generator.INDENT) ? line.slice(generator.INDENT.length) : line)
    .join('\n');
}

generator.forBlock['cookbook'] = function (block: Blockly.Block): string {
  const name = block.getFieldValue('NAME') || 'Unnamed';
  const ingredients = generator.statementToCode(block, 'INGREDIENTS').replace(/\n$/, '');
  const steps = generator.statementToCode(block, 'STEPS').replace(/\n$/, '');
  const code = ("recipe" + ' ' + name + ' ' + "{" + '\n' + ingredients + '\n' + steps + '\n' + "}").trim();
  return code;
};

generator.forBlock['ingredient'] = function (block: Blockly.Block): string {
  const name = block.getFieldValue('NAME') || 'Unnamed';
  const amount = block.getFieldValue('AMOUNT') || 'Unnamed';
  const code = ("ingredient" + ' ' + name + ' ' + amount).trim();
  return code + '\n';
};

generator.forBlock['step'] = function (block: Blockly.Block): string {
  const number = block.getFieldValue('NUMBER') || 'Unnamed';
  const action = block.getFieldValue('ACTION') || 'Unnamed';
  const code = ("step" + ' ' + number + ' ' + action).trim();
  return code + '\n';
};
