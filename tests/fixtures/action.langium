grammar ActionExample

entry Model:
    'model' ({infer Extra} extra=ID)?;

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
hidden terminal WS: /\s+/;