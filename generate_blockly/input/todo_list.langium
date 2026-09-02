grammar Todo

entry Model:
    'todo' name=ID '{'
        items+=Task*
    '}';

Task:
    'task'
    name=ID
    priority=('low' | 'medium' | 'high')
    done=('yes' | 'no')
;

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal WS hidden: /\s+/;