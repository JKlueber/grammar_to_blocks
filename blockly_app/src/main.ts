import * as Blockly from 'blockly';
import { defineBlocks } from './blocks';
import { generator } from './generator';

defineBlocks();

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: {
    "kind": "flyoutToolbox",
    "contents": [
      { "kind": "block", "type": "addressbook" },
      { "kind": "block", "type": "contact" },
      { "kind": "block", "type": "phone" },
      { "kind": "block", "type": "address" }
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
