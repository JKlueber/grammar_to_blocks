import * as Blockly from 'blockly';

// Export a function to define our blocks
export function defineBlocks() {
  Blockly.defineBlocksWithJsonArray(
    [
      {
        "type": "project",
        "message0": "project Name: %1 { Metadata: %2 Members: %3 Modules: %4 Tasks: %5 }",
        "args0": [
          {
            "type": "field_input",
            "name": "NAME",
            "text": ""
          },
          {
            "type": "input_value",
            "name": "METADATA"
          },
          {
            "type": "input_statement",
            "name": "MEMBERS",
            "check": "member"
          },
          {
            "type": "input_statement",
            "name": "MODULES",
            "check": "module"
          },
          {
            "type": "input_statement",
            "name": "TASKS",
            "check": "task"
          }
        ],
        "colour": 185,
        "previousStatement": null,
        "nextStatement": null
      },
      {
        "type": "metadata",
        "message0": "metadata { Version: %1 Visibility: %2 }",
        "args0": [
          {
            "type": "field_number",
            "name": "VERSION",
            "value": 0
          },
          {
            "type": "field_dropdown",
            "name": "VISIBILITY",
            "options": [
              [
                "public",
                "public"
              ],
              [
                "private",
                "private"
              ]
            ]
          }
        ],
        "colour": 47,
        "previousStatement": null,
        "nextStatement": null
      },
      {
        "type": "member",
        "message0": "member Name: %1 Role: %2",
        "args0": [
          {
            "type": "field_input",
            "name": "NAME",
            "text": ""
          },
          {
            "type": "field_dropdown",
            "name": "ROLE",
            "options": [
              [
                "manager",
                "manager"
              ],
              [
                "developer",
                "developer"
              ],
              [
                "tester",
                "tester"
              ],
              [
                "designer",
                "designer"
              ]
            ]
          }
        ],
        "colour": 330,
        "previousStatement": "member",
        "nextStatement": "member"
      },
      {
        "type": "module",
        "message0": "module Name: %1 Type: %2 { Components: %3 }",
        "args0": [
          {
            "type": "field_input",
            "name": "NAME",
            "text": ""
          },
          {
            "type": "field_dropdown",
            "name": "TYPE",
            "options": [
              [
                "frontend",
                "frontend"
              ],
              [
                "backend",
                "backend"
              ],
              [
                "database",
                "database"
              ],
              [
                "shared",
                "shared"
              ]
            ]
          },
          {
            "type": "input_statement",
            "name": "COMPONENTS",
            "check": "component"
          }
        ],
        "colour": 284,
        "previousStatement": "module",
        "nextStatement": "module"
      },
      {
        "type": "component",
        "message0": "component Name: %1 Language: %2 Lines: %3",
        "args0": [
          {
            "type": "field_input",
            "name": "NAME",
            "text": ""
          },
          {
            "type": "field_dropdown",
            "name": "LANGUAGE",
            "options": [
              [
                "java",
                "java"
              ],
              [
                "typescript",
                "typescript"
              ],
              [
                "python",
                "python"
              ],
              [
                "cpp",
                "cpp"
              ]
            ]
          },
          {
            "type": "field_number",
            "name": "LINES",
            "value": 0
          }
        ],
        "colour": 333,
        "previousStatement": "component",
        "nextStatement": "component"
      },
      {
        "type": "task",
        "message0": "task Title: %1 Priority: %2 Status: %3 Assignee: %4 Module: %5 Estimate: %6 { Subtasks: %7 }",
        "args0": [
          {
            "type": "field_input",
            "name": "TITLE",
            "text": ""
          },
          {
            "type": "field_dropdown",
            "name": "PRIORITY",
            "options": [
              [
                "low",
                "low"
              ],
              [
                "medium",
                "medium"
              ],
              [
                "high",
                "high"
              ]
            ]
          },
          {
            "type": "field_dropdown",
            "name": "STATUS",
            "options": [
              [
                "todo",
                "todo"
              ],
              [
                "doing",
                "doing"
              ],
              [
                "done",
                "done"
              ]
            ]
          },
          {
            "type": "input_value",
            "name": "ASSIGNEE"
          },
          {
            "type": "input_value",
            "name": "MODULE"
          },
          {
            "type": "field_number",
            "name": "ESTIMATE",
            "value": 0
          },
          {
            "type": "input_statement",
            "name": "SUBTASKS",
            "check": "subtask"
          }
        ],
        "colour": 133,
        "previousStatement": "task",
        "nextStatement": "task"
      },
      {
        "type": "subtask",
        "message0": "subtask Title: %1 Completed: %2",
        "args0": [
          {
            "type": "field_input",
            "name": "TITLE",
            "text": ""
          },
          {
            "type": "field_dropdown",
            "name": "COMPLETED",
            "options": [
              [
                "yes",
                "yes"
              ],
              [
                "no",
                "no"
              ]
            ]
          }
        ],
        "colour": 189,
        "previousStatement": "subtask",
        "nextStatement": "subtask"
      }
    ]
  );
}
