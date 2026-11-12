/**
 * AgendaFill.gs  v1.0  (Raven Band, 11/12/2026)
 *
 * Fills the WORK SESSION and FOCUS WALL boxes on each block's Daily Rehearsal slide from Mat's weekly lesson plan.
 *
 *   - The Lesson Plan Generator (school account) sends the week here when Mat turns in his plan, or presses
 *     "Send to agenda": POST {k, a:'planPut', weekOf, today, days:[{date, blocks:{'1st':[lines], ...}}],
 *     focus:{'1st':{learning, why, success}, ...}}  (ClosingScores.gs doPost hands it to agendaPlanPut_).
 *   - It is saved in the Content Pool sheet:
 *       "Agenda Plan"  Date | Block | Work Session (one item per line) | Sent
 *       "Agenda Focus" Week Of (Monday) | Block | Learning | Why | Success | Sent
 *     Mat can change a future day right in those tabs; the slide picks it up that morning.
 *   - agendaFillDaily runs every weekday ~5:40 AM and fills today's boxes. A day/block with no row (no class, or
 *     no plan sent) is left exactly as it is. "Send to agenda" (today: true) also fills today's boxes right away.
 *   - WORK SESSION: everything under the heading is replaced, one line per item, keeping the box's font/bullets.
 *     If the items wouldn't fit the box, the text gets smaller (16 down to 12 pt).
 *   - FOCUS WALL: only the text after "Learning:", "Why:" and "Success:" changes (the bold labels stay). A blank
 *     value leaves that line as it is.
 *   - Boxes are found the same way the map finds them: the slide with "<block> Block Agenda" and the box whose
 *     text starts with "WORK SESSION" / "FOCUS WALL". Keep those headings and the agenda keeps working.
 *
 * Lives in the "Class Agenda – Daily Slide Updater" project with Code.gs, ClosingScores.gs and NinjaGoals.gs.
 * SET UP (once): run setupAgendaFill (makes the weekday morning trigger). Same deck + sheet: no new permissions.
 */

var AGENDA = {
  PLAN_TAB: 'Agenda Plan',
  FOCUS_TAB: 'Agenda Focus',
  FILL_HOUR: 5, FILL_MINUTE: 40,
  BODY_SIZE: 16, MIN_SIZE: 12,          // WORK SESSION item font size, and the smallest it may shrink to
  FOCUS_LABELS: [['learning', 'Learning'], ['why', 'Why'], ['success', 'Success']],
  MAX_LINES: 12, MAX_LINE: 160          // sanity limits on what the generator may send
};

// ---------------------------------------------------------------- receive the plan

/** planPut: saves the week (replacing what was there for those dates/that week) and, if p.today, fills today now. */
function agendaPlanPut_(p, now) {
  var weekOf = boardYmd_(p.weekOf);
  if (!weekOf || new Date(weekOf + 'T12:00:00').getDay() !== 1) throw new Error('weekOf must be a Monday (yyyy-mm-dd).');
  var days = p.days || [], focus = p.focus || {}, sent = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var planRows = [], dates = {};
  days.forEach(function (d) {
    var date = boardYmd_(d.date);
    if (!date || date < weekOf || date > agendaAddDays_(weekOf, 4)) throw new Error('Day ' + d.date + ' is not in the week of ' + weekOf + '.');
    dates[date] = 1;
    Object.keys(d.blocks || {}).forEach(function (b) {
      if (CLOSING.BLOCKS.indexOf(b) < 0) throw new Error('Unknown block: ' + b);
      var lines = agendaCleanLines_(d.blocks[b]);
      if (lines.length) planRows.push([agendaDate_(date), b, lines.join('\n'), sent]);
    });
  });
  var focusRows = [];
  Object.keys(focus).forEach(function (b) {
    if (CLOSING.BLOCKS.indexOf(b) < 0) throw new Error('Unknown block: ' + b);
    var f = focus[b] || {}, vals = AGENDA.FOCUS_LABELS.map(function (l) { return String(f[l[0]] || '').replace(/\s+/g, ' ').trim().slice(0, 300); });
    if (vals.join('')) focusRows.push([agendaDate_(weekOf), b].concat(vals).concat([sent]));
  });

  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(CLOSING.LOG_SHEET_ID);
    var plan = agendaTab_(ss, AGENDA.PLAN_TAB, ['Date', 'Block', 'Work Session', 'Sent']);
    agendaReplaceRows_(plan, 4, function (r) { return !!dates[boardYmd_(r[0])]; }, planRows);
    var fo = agendaTab_(ss, AGENDA.FOCUS_TAB, ['Week Of', 'Block', 'Learning', 'Why', 'Success', 'Sent']);
    if (focusRows.length) agendaReplaceRows_(fo, 6, function (r) { return boardYmd_(r[0]) === weekOf; }, focusRows);
  } finally { lock.releaseLock(); }

  var out = { weekOf: weekOf, days: Object.keys(dates).length, rows: planRows.length, focus: focusRows.length, filled: [] };
  var today = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (p.today && dates[today]) out.filled = agendaFill_(today);
  return out;
}

function agendaCleanLines_(lines) {
  if (!lines || !lines.map) return [];
  return lines.map(function (l) { return String(l == null ? '' : l).replace(/[\r\n\u000b]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, AGENDA.MAX_LINE); })
    .filter(function (l) { return l; }).slice(0, AGENDA.MAX_LINES);
}
function agendaAddDays_(ymd, n) {
  var d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
/** A real date for the sheet (noon, so no time zone can move it to another day). */
function agendaDate_(ymd) { return new Date(ymd + 'T12:00:00'); }
function agendaTab_(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
/** Keeps the header and every row that drop() says no to, then writes add after them (sorted by date, then block). */
function agendaReplaceRows_(sh, width, drop, add) {
  var last = sh.getLastRow();
  var keep = last > 1 ? sh.getRange(2, 1, last - 1, width).getValues().filter(function (r) { return !drop(r) && String(r[1]).trim(); }) : [];
  var all = keep.concat(add).sort(function (x, y) {
    var a = boardYmd_(x[0]), b = boardYmd_(y[0]);
    return a < b ? -1 : a > b ? 1 : CLOSING.BLOCKS.indexOf(String(x[1])) - CLOSING.BLOCKS.indexOf(String(y[1]));
  });
  if (last > 1) sh.getRange(2, 1, last - 1, width).clearContent();
  if (all.length) sh.getRange(2, 1, all.length, width).setValues(all);
}

// ---------------------------------------------------------------- fill the slides

/** Trigger: every day ~5:40 AM; does nothing on weekends. */
function agendaFillDaily() {
  var now = new Date(), dow = now.getDay();
  if (dow === 0 || dow === 6) return;
  var done = agendaFill_(Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  Logger.log('Agenda filled: ' + (done.join(', ') || 'nothing planned today'));
}

/** Fills each block that has a plan row for this date. Returns e.g. ['1st', '3rd focus', ...]. */
function agendaFill_(ymd) {
  var ss = SpreadsheetApp.openById(CLOSING.LOG_SHEET_ID), work = {}, focus = {};
  var monday = agendaAddDays_(ymd, 1 - (new Date(ymd + 'T12:00:00').getDay() || 7));
  var plan = ss.getSheetByName(AGENDA.PLAN_TAB), fo = ss.getSheetByName(AGENDA.FOCUS_TAB);
  if (plan && plan.getLastRow() > 1) plan.getRange(2, 1, plan.getLastRow() - 1, 3).getValues().forEach(function (r) {
    if (boardYmd_(r[0]) === ymd && String(r[2]).trim()) work[String(r[1]).trim()] = String(r[2]).split(/\r?\n/);
  });
  if (fo && fo.getLastRow() > 1) fo.getRange(2, 1, fo.getLastRow() - 1, 5).getValues().forEach(function (r) {
    if (boardYmd_(r[0]) === monday) focus[String(r[1]).trim()] = { learning: r[2], why: r[3], success: r[4] };
  });
  var done = [];
  if (!Object.keys(work).length && !Object.keys(focus).length) return done;
  var slides = SlidesApp.openById(CLOSING.SLIDES_ID).getSlides();
  CLOSING.BLOCKS.forEach(function (b) {
    if (!work[b] && !focus[b]) return;
    var box = agendaBoxes_(slides, b);
    if (!box) { Logger.log('No "' + b + ' Block Agenda" slide.'); return; }
    if (work[b] && box.work && agendaSetWork_(box.work, work[b])) done.push(b);
    if (focus[b] && box.focus && agendaSetFocus_(box.focus, focus[b])) done.push(b + ' focus');
  });
  return done;
}

/** { work: Shape, focus: Shape } on the block's slide, or null if there is no such slide. */
function agendaBoxes_(slides, block) {
  var re = new RegExp('^\\s*' + block + '\\s+Block\\s+Agenda', 'i');
  for (var i = 0; i < slides.length; i++) {
    var els = slides[i].getPageElements(), isBlock = false, out = { work: null, focus: null };
    for (var j = 0; j < els.length; j++) {
      if (els[j].getPageElementType() !== SlidesApp.PageElementType.SHAPE) continue;
      var sh = els[j].asShape(), t = sh.getText().asString();
      if (re.test(t)) isBlock = true;
      if (/^\s*WORK\s*SESSION/i.test(t)) out.work = sh;
      if (/^\s*FOCUS\s*WALL/i.test(t)) out.focus = sh;
    }
    if (isBlock) return out;
  }
  return null;
}

/** Replaces everything under the WORK SESSION heading with the lines (style of the first item kept). true if changed. */
function agendaSetWork_(shape, lines) {
  lines = agendaCleanLines_(lines);
  if (!lines.length) return false;
  var tr = shape.getText(), s = tr.asString(), h = s.indexOf('\n');
  if (h < 0) return false;
  var body = lines.join('\n'), start = h + 1, end = tr.getLength() - 1;   // the box's last newline always stays
  if (s.slice(start, end) === body) return false;
  var size = agendaFitSize_(shape, lines);
  var empty = end <= start;
  if (!empty) tr.getRange(start, end).setText(body);                   // keeps the first item's font + bullets
  else tr.insertText(h, '\n' + body);                                  // heading only: new lines go before its newline
  var st = shape.getText().getRange(start, start + body.length).getTextStyle();   // fresh range: the old one is stale after an edit
  st.setBold(false); st.setFontSize(size);
  if (empty) st.setFontFamily('Lato');                                 // would otherwise copy the heading's font
  return true;
}

/** Font size so the items fit the box: BODY_SIZE unless they'd overflow, then smaller, never below MIN_SIZE. */
function agendaFitSize_(shape, lines) {
  var w = Number(shape.getWidth()) || 0, hgt = Number(shape.getHeight()) || 0;
  if (!w || !hgt) return AGENDA.BODY_SIZE;
  var usable = Math.max(40, w - 36 - 14), room = hgt - 14 * 1.25 - 14;   // bullet indent + insets; heading line + insets
  for (var size = AGENDA.BODY_SIZE; size > AGENDA.MIN_SIZE; size--) {
    if (agendaTextHeight_(lines, size, usable) <= room) return size;
  }
  return AGENDA.MIN_SIZE;
}
function agendaTextHeight_(lines, size, usable) {
  var perLine = Math.max(8, Math.floor(usable / (size * 0.5)));        // Lato: about half the font size per letter
  return lines.reduce(function (n, l) { return n + Math.max(1, Math.ceil(l.length / perLine)); }, 0) * size * 1.25;
}

/** Sets the text after "Learning:", "Why:", "Success:" (labels and their style stay). true if anything changed. */
function agendaSetFocus_(shape, f) {
  var changed = false;
  AGENDA.FOCUS_LABELS.forEach(function (l) {
    var v = String(f[l[0]] == null ? '' : f[l[0]]).replace(/\s+/g, ' ').trim();
    if (!v) return;
    var tr = shape.getText(), s = tr.asString(), m = new RegExp('(^|\\n)(' + l[1] + '[ \\t]*:[ \\t]*)', 'i').exec(s);
    if (!m) return;
    var start = m.index + m[1].length + m[2].length, end = s.indexOf('\n', start);
    if (end < 0) end = s.length;
    if (s.slice(start, end) === v) return;
    if (end > start) tr.getRange(start, end).setText(v);
    else tr.insertText(start, v);
    shape.getText().getRange(start, start + v.length).getTextStyle().setBold(false);
    changed = true;
  });
  return changed;
}

// ---------------------------------------------------------------- setup

/** Run once: the weekday-morning trigger. */
function setupAgendaFill() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'agendaFillDaily') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('agendaFillDaily').timeBased().everyDays(1).atHour(AGENDA.FILL_HOUR).nearMinute(AGENDA.FILL_MINUTE).create();
  Logger.log('Agenda fill is on: every weekday about ' + AGENDA.FILL_HOUR + ':' + AGENDA.FILL_MINUTE + ' AM.');
}

/** Run from the editor to fill today's boxes now (same as the morning run). */
function agendaFillNow() { Logger.log('Filled: ' + (agendaFill_(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')).join(', ') || 'nothing planned today')); }

/** Run once from the editor to check the look on real Slides: copies the deck, fills 3rd Block of the COPY with sample
 *  items + Focus Wall, and logs the copy's link and text. The live deck is never touched. Trash the copy afterwards. */
function agendaTryOnCopy() {
  var copy = DriveApp.getFileById(CLOSING.SLIDES_ID).makeCopy('TEST COPY (delete me) – agenda fill');
  var box = agendaBoxes_(SlidesApp.openById(copy.getId()).getSlides(), '3rd');
  if (!box) throw new Error('No 3rd Block slide in the copy.');
  agendaSetWork_(box.work, ['Technique Builder #4', 'ToE Book 1 #81 "Sample Line"', 'Abundant Joy (mm. 5–20)', 'Music Theory: key signatures']);
  agendaSetFocus_(box.focus, { learning: 'Sample learning target', why: 'Sample essential question?', success: 'I can do the sample thing.' });
  Logger.log('Copy: ' + copy.getUrl() + '\nWORK: ' + box.work.getText().asString() + '\nFOCUS: ' + box.focus.getText().asString());
  return copy.getId();
}
