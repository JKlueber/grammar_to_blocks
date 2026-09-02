grammar ProjectDSL

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;

entry Project:
    'project' name=ID '{'
        (members+=Member)*
        (tasks+=Task)*
    '}';

Member:
    'member' name=ID;

Task:
    'task'
    title=ID
    'assignee'
    assignee=[Member:ID];