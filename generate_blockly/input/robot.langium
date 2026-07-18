grammar Robot

entry Program:
    commands+=Command*;

Command:
    'move' label=ID? direction=('forward' | 'backward' | 'left' | 'right') distance=Amount;

Amount:
    value=INT;

terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
