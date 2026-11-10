# Daily Rhythms generator

Makes the 780 rhythm images in the "Daily Rhythms" Drive folder (60 per ensemble + time signature)
and `out/rhythm-counts.json` (the counts the board shows with "Show counts").

    npm install && node gen.js out

The random numbers are seeded (20261104), so with these exact package versions a run is repeatable.
v1 (11/4/2026) was reproduced byte for byte before v2 (11/9/2026) changed the spacing; v2 draws new rhythms.

**The images in Drive and the counts file must come from the same run.** After a run: upload every PNG to
the Daily Rhythms folder (Drive asks about same-named files: "Replace existing files", so the file IDs and
Code.gs's decks stay), and copy `out/rhythm-counts.json` to the site root (next to index.html). The board
only shows counts when the picture's size in Drive matches the file, so a half-finished swap shows a
note instead of wrong counts.

Counts (Mat, 11/9/2026): 1 e + a; 6/8 = 1 2 3 4 5 6 (sixteenths between = +); rests in (parentheses);
beats held through by a longer note are dim. Each entry: [x as a fraction of the image width, label, kind]
with kind n note, r rest, h held beat, hr held rest.
