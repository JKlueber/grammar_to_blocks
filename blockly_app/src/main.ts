import * as Blockly from 'blockly';
import { defineBlocks } from './blocks';
import { generator } from './generator';

// define custom blocks before setting up the workspace
defineBlocks();

// set up the Blockly workspace
const workspace = Blockly.inject('blocklyDiv', {
  toolbox: {
    "kind": "flyoutToolbox",
    "contents": [
      { "kind": "block", "type": "project" },
      { "kind": "block", "type": "metadata" },
      { "kind": "block", "type": "member" },
      { "kind": "block", "type": "module" },
      { "kind": "block", "type": "component" },
      { "kind": "block", "type": "task" },
      { "kind": "block", "type": "subtask" }
    ]
  }
});

// show code and errors
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

// generate code whenever the workspace changes
workspace.addChangeListener(generateCode);
