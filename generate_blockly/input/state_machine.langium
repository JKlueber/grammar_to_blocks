grammar StateMachine

entry Machine:
    'machine' name=ID '{'
        states+=State+
    '}';

State:
    'state'
    name=ID
    kind=('start' | 'normal' | 'end')
;

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal WS hidden: /\s+/;