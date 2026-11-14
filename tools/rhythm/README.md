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

## Two-part rhythms (2.17.0, 11/14/2026)

    node gen-duo.js out-duo

Makes `out-duo/duo_<level>_<meter>_<nnn>_1.png` / `_2.png` and `out-duo/rhythm-duos.json` (24 pairs per level + meter, seed
20261114). Copy the PNGs to the site's `rhythm-duos/` folder and the JSON to the site root; the board and practice.html read
them from there (not from Drive). Rules for a pair are at the top of gen-duo.js; `ONLY=8th:4/4` makes just one kind (to try
changes). `tests/rhythm_duos_test.js` checks the files match the JSON and the parts line up.
