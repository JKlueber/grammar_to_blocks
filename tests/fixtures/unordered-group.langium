grammar UnorderedGroupDemo

entry Pair:
    'pair' (a=ID & b=ID);

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
hidden terminal WS: /\s+/;
