grammar Reservation

// Demonstrates UnorderedGroup ("&") mixed with keywords: the guest name,
// the 'nights' count, and the 'room' number can be written in any order,
// but all three must appear.
entry Booking:
    'booking' (guest=ID & 'nights' nights=INT & 'room' room=ID);

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal INT returns number: /[0-9]+/;
hidden terminal WS: /\s+/;
