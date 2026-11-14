# Dojo → Rhythm Practice button (2.16.0, Mat 11/14)

The practice page lives on this site: `practice.html`. The Band Ninja Dojo only needs a button that opens it with the
student's level, so the right rhythms come up first:

    https://artificialfear.github.io/agenda-board/practice.html?lvl=LEVEL

| Band (block)                         | `lvl`  |
|--------------------------------------|--------|
| 8th Grade Band (1st Block)           | `8th`  |
| 7th Grade Band (3rd + 4th Block)     | `7th`  |
| 6th Grade Intermediate (6th Block)   | `6int` |
| 6th Grade Beginning (7th Block)      | `6beg` |

Optional: `&m=4-4` (2-4, 3-4, 4-4, 6-8) picks the time signature. The page also takes `&n=Name` to show a name, but the
Dojo button should leave that off (the page is on a public site; it doesn't need to know who is practicing).
Students can still switch levels on the page; it remembers their last choice on that device.

## Code for the Dojo (MyProgress.gs + its HTML, Progress Charts Apps Script project)

Server side, next to where the student's block is known:

```js
// 2.16.0: Rhythm Practice link for the student's band
function rhythmPracticeUrl_(block) {
  var lvl = { '1st': '8th', '3rd': '7th', '4th': '7th', '6th': '6int', '7th': '6beg' }[String(block).trim()] || '7th';
  return 'https://artificialfear.github.io/agenda-board/practice.html?lvl=' + lvl;
}
```

Send `rhythmPracticeUrl_(student.block)` to the page with the rest of the student's data, and add a pill/button with the
other resource links:

```html
<a class="pill" href="<?= practiceUrl ?>" target="_blank" rel="noopener">🥁 Rhythm Practice</a>
```

(Match whatever the Dojo's existing resource pills use: the class name and how the data reaches the HTML.) Deploy:
Deploy → Manage deployments → edit the existing web app deployment → New version, so the Dojo URL stays the same.
