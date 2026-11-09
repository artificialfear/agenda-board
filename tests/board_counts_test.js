// ClosingScores.gs v1.2: a=stats and a=line with fake sheets (made-up data, no real students)
const fs = require('fs'), path = require('path'), a = require('assert');
const D = (y, m, d) => new Date(y, m - 1, d);
const pad = n => String(n).padStart(2, '0');
global.Utilities = { formatDate: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), getUuid: () => 'x' };
global.Session = { getScriptTimeZone: () => 'America/New_York' };
const cache = {}; global.CacheService = { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'KEY' }) };
global.ContentService = { MimeType: { JSON: 'j' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) };
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
global.Logger = { log() {} };
const targets = [['Pass-Off Targets'], [''], [''], ['Quarter', 'Ends', '6th Grade', '7th Grade', '8th Grade'], ['School year starts', 'Aug 3, 2026'],
  ['Q1', D(2026, 10, 7), 5, 20, 37], ['Q2', D(2026, 12, 16), 10, 30, 50], ['Q3', D(2027, 3, 16), 15, 30, 47]];
const log = [['Date', 'Student', 'Block'],
  ['', 'Test, A', '1st Block'],                       // undated history: ignored
  [D(2026, 10, 1), 'Test, A', '1st Block'],           // Q1: not this quarter
  [D(2026, 10, 20), 'Test, B', '1st Block'],          // Q2
  [D(2026, 11, 3), 'Test, C', '3rd Block'],           // Q2, last week
  [D(2026, 11, 9), 'Test, D', '3rd Block'],           // this week (Mon)
  [D(2026, 11, 11), 'Test, E', '3rd Block'],          // today
  [D(2026, 11, 11), 'Test, F', '7th Block']];
const line = [['ID', 'Joined', 'Student', 'Block', 'Pass-Off #', 'Status'],
  ['Q1', '11/10/2026', 'Test, G', '3rd Block', 5, ''],  // yesterday: ignored
  ['Q2', '11/11/2026', 'Test, H', '3rd Block', 6, ''],  // waiting
  ['Q3', D(2026, 11, 11), 'Test, I', '3rd Block', 7, ''], // waiting (date cell)
  ['Q4', '11/11/2026', 'Test, J', '3rd Block', 8, 'Passed'],
  ['Q5', '11/11/2026', 'Test, K', '4th Block', 9, '']];
const sheet = rows => ({ getLastRow: () => rows.length, getDataRange: () => ({ getValues: () => rows }),
  getRange: (r, c, nr, nc) => ({ getValues: () => rows.slice(r - 1, r - 1 + nr).map(x => { const o = x.slice(c - 1, c - 1 + nc); while (o.length < nc) o.push(''); return o; }) }) });
global.SpreadsheetApp = { openById: () => ({ getSheetByName: n => ({ 'Pass-Off Targets': sheet(targets), 'Pass-Off Log': sheet(log), 'Pass-Off Line': sheet(line) })[n] || null }) };
eval(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ClosingScores.gs'), 'utf8'));
const realDate = Date; global.Date = class extends realDate { constructor(...x) { if (x.length) super(...x); else super(2026, 10, 11, 10, 0); } static [Symbol.hasInstance](o) { return o instanceof realDate; } };
const st = doGet({ parameter: { a: 'stats', k: 'KEY' } });
a.ok(st.ok, st.error); a.equal(st.quarter, 'Q2'); a.equal(st.weekStart, '2026-11-09');
const by = Object.fromEntries(st.blocks.map(b => [b.block, b]));
a.deepEqual([by['1st'].quarter, by['1st'].week, by['1st'].today], [1, 0, 0]);
a.deepEqual([by['3rd'].quarter, by['3rd'].week, by['3rd'].today], [3, 2, 1]);
a.deepEqual([by['7th'].quarter, by['7th'].today], [1, 1]);
a.ok(!JSON.stringify(st).includes('Test,'), 'no names in stats');
const ln = doGet({ parameter: { a: 'line', block: '3rd', k: 'KEY' } });
a.ok(ln.ok, ln.error); a.deepEqual([ln.waiting, ln.passedToday], [2, 1]);
a.ok(!JSON.stringify(ln).includes('Test,'), 'no names in line');
a.equal(doGet({ parameter: { a: 'line', block: '2nd', k: 'KEY' } }).ok, false);
a.equal(doGet({ parameter: { a: 'stats', k: 'nope' } }).ok, false);
console.log('board counts checks ok');
