// ClosingScores.gs v1.8: Playing Test days — a=ptest (slide line + class list as "First L." + today's scores) and a=ptscore.
// Made-up students only.
const fs = require('fs'), path = require('path'), a = require('assert');
const cache = {}; global.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k === 'closingKey' ? 'KEY' : null) }) };
global.ContentService = { MimeType: { JSON: 'j' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) };
global.Session = { getScriptTimeZone: () => 'America/New_York' };
let locks = 0; global.LockService = { getScriptLock: () => ({ waitLock() { locks++; }, releaseLock() {} }) };
global.Logger = { log() {} };
const p2 = n => String(n).padStart(2, '0');
global.Utilities = { formatDate: (d, tz, f) => f === 'yyyy-MM-dd HH:mm'
  ? d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes())
  : d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) };
global.ScriptApp = { getProjectTriggers: () => [] };

// ---- slides: title shape + WORK SESSION shape per block
const work = { '1st': 'Foundations pg. 4\nPlaying Test: F Concert scale, ToE #72', '3rd': 'Playing Test\n• Bb scale\n• Lightly Row\n\nAbundant Joy',
  '4th': 'ToE pg 20 #70-71', '6th': 'PLAYING TESTS - Hot Cross Buns', '7th': 'Warm Up Set 1\nTest your neighbor on note names' };
const shape = t => ({ getPageElementType: () => 'S', asShape: () => ({ getText: () => ({ asString: () => t + '\n' }) }) });
global.SlidesApp = { PageElementType: { SHAPE: 'S', TABLE: 'T' }, openById: () => ({ getSlides: () => Object.keys(work).map(b => ({
  getPageElements: () => [shape(b + ' Block Agenda'), shape('WORK SESSION\n' + work[b]), shape('REMINDERS\nNo playing test tomorrow? Ask.')] })) }) };

// ---- sheet tabs
function mkTab(vals) {
  const t = { vals, getLastRow: () => vals.length, getLastColumn: () => (vals[0] || []).length,
    getRange: (r, c, nr, nc) => ({ getDisplayValues: () => vals.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc).map(v => v == null ? '' : String(v))),
      setValues(v) { v.forEach((line, i) => { vals[r - 1 + i] = (vals[r - 1 + i] || []).slice(0, c - 1).concat(line); }); return this; }, setFontWeight() { return this; } }),
    setFrozenRows() {}, deleteRow(r) { vals.splice(r - 1, 1); } };
  return t;
}
const tabs = {
  '1st Block': mkTab([['Pass Offs', 'Instrument', 'Total'], ['Rivera, Ana', 'Flute', 3], ['Rivera, Ana', 'Flute', 1], ['Rios, Ana', 'Clarinet', 2],
    ['Test, Student', 'Flute', 0], ['Okafor, Zane', 'Trumpet', 9], ['Lee, Mia', 'Tuba', 4], ['', '', ''], ['Ghost, After Blank', 'Horn', 0]]),
  '3rd Block': mkTab([['Pass Offs'], ['Brooks, Theo'], ['Brown, Theo'], ['Kim, Jo'], ['Block Average']]),
};
global.SpreadsheetApp = { openById: () => ({ getSheetByName: n => tabs[n] || null, insertSheet: n => (tabs[n] = mkTab([])) }) };
eval(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ClosingScores.gs'), 'utf8'));

const NOW = new Date(2026, 10, 12, 9, 40);
// slide line
a.equal(boardPtest_('1st', NOW).test, 'F Concert scale, ToE #72', 'rest of the line');
a.equal(boardPtest_('3rd', NOW).test, 'Bb scale · Lightly Row', 'bare "Playing Test" line takes the lines under it, stops at the blank line');
a.equal(boardPtest_('6th', NOW).test, 'Hot Cross Buns', '"PLAYING TESTS - …"');
a.equal(boardPtest_('4th', NOW).test, '', 'no line = no test');
a.equal(boardPtest_('7th', NOW).test, '', '"Test your neighbor…" is not a playing test');
a.throws(() => boardPtest_('2nd', NOW));
// class list
let r = boardPtest_('1st', NOW);
a.deepEqual(r.students.map(s => s.n), ['Ana Rio.', 'Ana Riv.', 'Ana Riv. 2', 'Mia L.', 'Zane O.'], 'First L.; clashes get more letters, same-name twins get 2; test rows + rows after the first blank skipped');
r.students.forEach(s => { a.equal(Object.keys(s).sort().join(), 'id,n', 'only id + short name reach the board'); a.ok(/^[0-9a-z]+$/.test(s.id)); });
a.equal(JSON.stringify(r).includes('Rivera'), false, 'no last names in the answer');
a.deepEqual(boardPtest_('3rd', NOW).students.map(s => s.n), ['Jo K.', 'Theo Broo.', 'Theo Brow.'], 'Brooks/Brown need 4 letters; "Block Average" skipped');
// scores
const mia = r.students.find(s => s.n === 'Mia L.').id;
let out = doGet({ parameter: { k: 'KEY', a: 'ptscore', block: '1st', id: mia, s: '3', note: 'great tone', test: 'F Concert scale, ToE #72' } });
a.ok(out.ok, out.error);
const PT = tabs['Playing Tests'];
a.deepEqual(PT.vals[0], ['Date', 'Block', 'Student', 'Test', 'Score', 'Note', 'Saved'], 'tab made with headers');
a.deepEqual(PT.vals[1].slice(0, 6), ['2026-11-12', '1st', 'Lee, Mia', 'F Concert scale, ToE #72', 3, 'great tone'], 'full name saved in the sheet');
doGet({ parameter: { k: 'KEY', a: 'ptscore', block: '1st', id: mia, s: '4', note: '', test: 'F Concert scale, ToE #72' } });
a.equal(PT.vals.length, 2, 'a re-score replaces the row'); a.equal(PT.vals[1][4], 4);
r = doGet({ parameter: { k: 'KEY', a: 'ptest', block: '1st' } });
a.deepEqual(r.scores[mia], { s: '4', note: '', test: 'F Concert scale, ToE #72' }, "today's scores come back for the remote");
a.equal(doGet({ parameter: { k: 'KEY', a: 'ptest', block: '3rd' } }).scores[mia], undefined, 'other blocks: none');
a.equal(doGet({ parameter: { k: 'KEY', a: 'ptscore', block: '1st', id: mia, s: '5', test: 'x' } }).ok, false, '1-4 only');
a.equal(doGet({ parameter: { k: 'KEY', a: 'ptscore', block: '1st', id: 'zzz', s: '2', test: 'x' } }).ok, false, 'unknown id refused');
a.equal(doGet({ parameter: { k: 'nope', a: 'ptest', block: '1st' } }).ok, false, 'key required');
doGet({ parameter: { k: 'KEY', a: 'ptscore', block: '1st', id: mia, s: '', test: 'F Concert scale, ToE #72' } });
a.equal(PT.vals.length, 1, 'blank score removes the row');
a.ok(locks >= 3, 'saves take the lock');
console.log('ptest checks ok');
