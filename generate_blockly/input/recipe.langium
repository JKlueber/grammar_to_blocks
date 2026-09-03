grammar Recipe

entry Cookbook:
    'recipe' name=ID '{'
        ingredients+=Ingredient*
        steps+=Step+
    '}';

Ingredient:
    'ingredient' name=ID amount=INT;

Step:
    'step' number=INT action=('add' | 'mix' | 'cook' | 'serve') ingredient=[Ingredient];

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal INT returns number: /[0-9]+/;
terminal WS hidden: /\s+/;