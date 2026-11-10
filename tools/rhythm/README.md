# Daily Rhythms generator

Makes the 780 rhythm images in the "Daily Rhythms" Drive folder (60 per ensemble + time signature)
and `rhythm-counts.json` (the counts the board shows with "Show counts").

    npm install && node gen.js out

The random numbers are seeded (20261104), so with these exact package versions it makes the same
images byte for byte as the ones uploaded 11/4/2026. Only `rhythm-counts.json` needs uploading
(into the same folder) unless the rules in gen.js change. If they do, upload all the PNGs too:
the counts file must always come from the same run as the images.

Counts (Mat, 11/9/2026): 1 e + a; 6/8 = 1 2 3 4 5 6 (sixteenths between = +); rests in (parentheses);
beats held through by a longer note are dim. Each entry: [x as a fraction of the image width, label, kind]
with kind n note, r rest, h held beat, hr held rest.
