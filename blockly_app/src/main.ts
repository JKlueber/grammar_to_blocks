import * as Blockly from 'blockly';
import { defineBlocks } from './blocks';
import { generator } from './generator';

defineBlocks();

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: {
  "kind": "categoryToolbox",
  "contents": [
    {
      "kind": "category",
      "name": "Main / Entry",
      "colour": "210",
      "contents": [
        {
          "kind": "block",
          "type": "cookbook"
        }
      ]
    },
    {
      "kind": "category",
      "name": "Elements & Components",
      "colour": "160",
      "contents": [
        {
          "kind": "block",
          "type": "ingredient"
        },
        {
          "kind": "block",
          "type": "step"
        }
      ]
    }
  ]
}
});

const codeOutput = document.getElementById('codeOutput');
const errorOutput = document.getElementById('errorOutput');

function generateCode() {
  try {
    const code = generator.workspaceToCode(workspace);
    if (codeOutput) codeOutput.textContent = code;
    if (errorOutput) errorOutput.textContent = '';
  } catch (e) {
    if (errorOutput) errorOutput.textContent = e instanceof Error ? e.message : String(e);
  }
}

workspace.addChangeListener(generateCode);
