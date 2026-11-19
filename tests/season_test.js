// 2.29.0: welcome screen seasonal themes (season.js calendar + Board Settings parsing). Run: node tests/season_test.js
const a = require('assert');
const S = require('../season.js');
const D = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

// calendar (Auto)
[[D(2026, 9, 30), 'none'], [D(2026, 10, 1), 'fall'], [D(2026, 10, 23), 'fall'], [D(2026, 10, 24), 'halloween'],
 [D(2026, 10, 31), 'halloween'], [D(2026, 11, 1), 'fall'], [D(2026, 11, 30), 'fall'], [D(2026, 12, 1), 'holidays'],
 [D(2026, 12, 31), 'holidays'], [D(2027, 1, 1), 'winter'], [D(2028, 2, 29), 'winter'], [D(2027, 3, 1), 'none'], [D(2027, 6, 15), 'none']]
  .forEach(([d, want]) => a.strictEqual(S.pick(d, {}).theme, want, d.toDateString()));
a.strictEqual(S.pick(D(2026, 11, 18), { season: 'Auto' }).theme, 'fall');
a.strictEqual(S.pick(D(2026, 11, 18), { season: 'something odd' }).theme, 'fall', 'unknown value = Auto');

// manual override and Off
a.strictEqual(S.pick(D(2026, 10, 5), { season: 'Winter' }).theme, 'winter');
a.strictEqual(S.pick(D(2026, 4, 5), { season: ' halloween ' }).theme, 'halloween');
['Off', 'none', 'NO'].forEach(v => a.strictEqual(S.pick(D(2026, 12, 5), { season: v }).theme, 'none', v));

// concert dates
const C = '12/9 Winter Concert 6:30 PM; 3/12/2027 - Spring Concert\n5/14/26';
const list = S.parseConcerts(C);
a.deepStrictEqual(list, [{ m: 12, d: 9, y: null, label: 'Winter Concert 6:30 PM' }, { m: 3, d: 12, y: 2027, label: 'Spring Concert' },
                         { m: 5, d: 14, y: 2026, label: '' }]);
a.deepStrictEqual(S.parseConcerts('13/40 nope; hello; '), []);
let p = S.pick(D(2026, 12, 9), { concerts: C });
a.deepStrictEqual([p.theme, p.label], ['concert', 'Winter Concert 6:30 PM']);
a.strictEqual(S.pick(D(2026, 12, 10), { concerts: C }).theme, 'holidays', 'day after = back to the season');
a.strictEqual(S.pick(D(2027, 3, 12), { concerts: C }).theme, 'concert');
a.strictEqual(S.pick(D(2028, 3, 12), { concerts: C }).theme, 'none', 'a dated concert only matches its year');
a.strictEqual(S.pick(D(2026, 5, 14), { concerts: C }).label, 'Concert', 'no text = "Concert"');
a.strictEqual(S.pick(D(2026, 12, 9), { concerts: C, season: 'Off' }).theme, 'none', 'Off beats a concert');
a.strictEqual(S.pick(D(2026, 12, 9), { concerts: C, season: 'Winter' }).theme, 'winter', 'a forced theme beats a concert');
p = S.pick(D(2026, 12, 10), { concerts: C, season: 'Concert' });
a.deepStrictEqual([p.theme, p.label], ['concert', 'Concert Day'], 'forced Concert with no concert today');

// animation switch
a.strictEqual(S.pick(D(2026, 11, 18), {}).fx, true);
a.strictEqual(S.pick(D(2026, 11, 18), { welcomeFx: 'On' }).fx, true);
['Off', 'no', 'FALSE'].forEach(v => a.strictEqual(S.pick(D(2026, 11, 18), { welcomeFx: v }).fx, false, v));
console.log('season_test: all passed');
