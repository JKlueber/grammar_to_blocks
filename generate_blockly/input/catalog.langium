grammar Catalog

// A fuller example: an entry rule with a stacking list (+=), where each
// stacked Product's own fields are an UnorderedGroup - title, price, and
// sku can appear in any order within a single product block.
entry Store:
    'store' name=ID '{'
        products+=Product*
    '}';

Product:
    'product' (title=ID & price=INT & 'sku' sku=ID);

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal INT returns number: /[0-9]+/;
hidden terminal WS: /\s+/;
