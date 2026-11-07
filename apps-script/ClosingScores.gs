/**
 * ClosingScores.gs  v1.0  (Raven Band, 11/7/2026)
 *
 * Lets the agenda board (the ViewSonic page) put closing rehearsal scores (1-3)
 * into the CLOSING table on each block's Daily Rehearsal slide.
 *   - The board sends: block (1st/3rd/4th/6th/7th), row (Effort/Performance/Attitude),
 *     day (the column header, e.g. WED) and the score (1, 2, 3 or blank to clear).
 *   - The score is written into that table cell, keeping the cell's look.
 *   - Every score is also logged to the "Closing Scores" tab of the Daily Slides content sheet
 *     (one row per date + block + category; a correction replaces the row).
 *   - Every Monday ~4 AM all closing tables are emptied for the new week.
 *
 * Lives in the same Apps Script project as the Daily Slides Code.gs (and NinjaGoals.gs).
 * Nothing in Code.gs needs to change. If saving says doGet is already defined, tell Claude.
 *
 * SET UP (once):
 *   1. Run setupClosingScores (function menu → Run). Approve if asked.
 *      It makes the Monday trigger and the board's secret key.
 *   2. Deploy → New deployment → type "Web app":
 *        Execute as: Me    Who has access: Anyone
 *      Copy the Web app URL.
 *   3. Run showClosingScoresLink and copy the link from the log (Execution log).
 *      Paste it on the board: ☰ → Settings → "Closing scores link". Save.
 *   If you ever change this file: Deploy → Manage deployments → ✏ → Version: New version → Deploy
 *   (keeps the same URL).
 */

var CLOSING = {
  SLIDES_ID: '1GVCu1ReJy-BPLXHb7omH8ijtz_c-XRWcftUtRguLMjY',      // Daily Rehearsal (All Band Classes)
  LOG_SHEET_ID: '1GeHtIMEPq2RIuceFiaXBoGpsz9tYpx442Q7AbzYp79E',   // Daily Slides content sheet
  LOG_TAB: 'Closing Scores',
  BLOCKS: ['1st', '3rd', '4th', '6th', '7th'],
  SCORES: ['1', '2', '3'],
  CLEAR_HOUR: 4
};

// ---------------------------------------------------------------- web app

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try {
    var key = PropertiesService.getScriptProperties().getProperty('closingKey');
    if (!key || p.k !== key) throw new Error('Wrong or missing key. Paste the link from showClosingScoresLink again.');
    var block = String(p.block || '');
    if (CLOSING.BLOCKS.indexOf(block) < 0) throw new Error('Unknown block: ' + block);
    if (p.a === 'set') {
      var v = String(p.v == null ? '' : p.v).trim();
      if (v !== '' && CLOSING.SCORES.indexOf(v) < 0) throw new Error('Score must be 1, 2 or 3.');
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        closingSet_(block, String(p.row || ''), String(p.day || ''), v);
      } finally { lock.releaseLock(); }
    }
    out = closingRead_(block);
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- table on the slide

/** Finds the block's agenda slide ("1st Block Agenda") and its CLOSING table. */
function closingTable_(block) {
  var deck = SlidesApp.openById(CLOSING.SLIDES_ID);
  var re = new RegExp('^\\s*' + block + '\\s+Block\\s+Agenda', 'i');
  var slides = deck.getSlides();
  for (var i = 0; i < slides.length; i++) {
    var els = slides[i].getPageElements(), isBlock = false, table = null;
    for (var j = 0; j < els.length; j++) {
      var el = els[j], t = el.getPageElementType();
      if (t === SlidesApp.PageElementType.SHAPE && re.test(el.asShape().getText().asString())) isBlock = true;
      if (t === SlidesApp.PageElementType.TABLE) {
        var tb = el.asTable();
        if (/^\s*closing\b/i.test(tb.getCell(0, 0).getText().asString())) table = tb;
      }
    }
    if (isBlock && table) return table;
  }
  throw new Error('No CLOSING table found on the ' + block + ' Block Agenda slide.');
}

function closingCellText_(table, r, c) {
  return table.getCell(r, c).getText().asString().replace(/\n$/, '').trim();
}

/** Day headers (row 0), category labels (column 0) and the current scores. */
function closingRead_(block) {
  var tb = closingTable_(block);
  var days = [], rows = [], values = [];
  for (var c = 1; c < tb.getNumColumns(); c++) days.push(closingCellText_(tb, 0, c));
  for (var r = 1; r < tb.getNumRows(); r++) {
    rows.push(closingCellText_(tb, r, 0));
    var line = [];
    for (var c2 = 1; c2 < tb.getNumColumns(); c2++) line.push(closingCellText_(tb, r, c2));
    values.push(line);
  }
  return { block: block, days: days, rows: rows, values: values };
}

function closingSet_(block, rowLabel, dayLabel, v) {
  var tb = closingTable_(block);
  var r = -1, c = -1;
  for (var i = 1; i < tb.getNumRows(); i++) if (closingCellText_(tb, i, 0).toLowerCase() === rowLabel.toLowerCase()) r = i;
  for (var j = 1; j < tb.getNumColumns(); j++) if (closingCellText_(tb, 0, j).toLowerCase() === dayLabel.toLowerCase()) c = j;
  if (r < 0) throw new Error('No "' + rowLabel + '" row in the ' + block + ' Block closing table.');
  if (c < 0) throw new Error('No "' + dayLabel + '" column in the ' + block + ' Block closing table.');
  closingWriteCell_(tb.getCell(r, c), v);
  closingLog_(block, tb, r, c, v);
}

/** Replaces a cell's text but keeps its font, size, color, bold and alignment. */
function closingWriteCell_(cell, v) {
  var tr = cell.getText();
  var st = tr.getTextStyle();
  var look = { font: st.getFontFamily(), size: st.getFontSize(), bold: st.isBold(), color: null, align: null };
  try { look.color = st.getForegroundColor().asRgbColor().asHexString(); } catch (e) {}
  try { look.align = tr.getParagraphStyle().getParagraphAlignment(); } catch (e) {}
  tr.setText(v === '' ? ' ' : v);              // a space keeps the empty cell's style
  var ns = tr.getTextStyle();
  if (look.font) ns.setFontFamily(look.font);
  if (look.size) ns.setFontSize(look.size);
  if (look.bold !== null && look.bold !== undefined) ns.setBold(look.bold);
  if (look.color) ns.setForegroundColor(look.color);
  if (look.align) { try { tr.getParagraphStyle().setParagraphAlignment(look.align); } catch (e) {} }
}

// ---------------------------------------------------------------- log sheet

function closingLogSheet_() {
  var ss = SpreadsheetApp.openById(CLOSING.LOG_SHEET_ID);
  var sh = ss.getSheetByName(CLOSING.LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(CLOSING.LOG_TAB);
    sh.getRange(1, 1, 1, 6).setValues([['Date', 'Block', 'Day', 'Category', 'Score', 'Entered']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function closingLog_(block, tb, r, c, v) {
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var date = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var day = closingCellText_(tb, 0, c), cat = closingCellText_(tb, r, 0);
  var sh = closingLogSheet_();
  var last = sh.getLastRow();
  var data = last > 1 ? sh.getRange(2, 1, last - 1, 4).getDisplayValues() : [];
  var rowIdx = -1;
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] === date && data[i][1] === block && data[i][3] === cat) { rowIdx = i + 2; break; }
  }
  if (v === '') { if (rowIdx > 0) sh.deleteRow(rowIdx); return; }    // cleared box = no score that day
  var line = [[date, block, day, cat, Number(v), now]];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, 6).setValues(line);
  else sh.getRange(last + 1, 1, 1, 6).setValues(line);
}

// ---------------------------------------------------------------- weekly clear + setup

/** Empties every block's closing scores (labels stay). Runs Mondays before school. */
function clearClosingScores() {
  CLOSING.BLOCKS.forEach(function (block) {
    try {
      var tb = closingTable_(block);
      for (var r = 1; r < tb.getNumRows(); r++)
        for (var c = 1; c < tb.getNumColumns(); c++)
          if (closingCellText_(tb, r, c) !== '') closingWriteCell_(tb.getCell(r, c), '');
    } catch (err) { Logger.log(block + ': ' + err.message); }
  });
}

function setupClosingScores() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('closingKey')) props.setProperty('closingKey', Utilities.getUuid().replace(/-/g, '').slice(0, 20));
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'clearClosingScores') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('clearClosingScores').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(CLOSING.CLEAR_HOUR).create();
  closingLogSheet_();
  CLOSING.BLOCKS.forEach(function (b) { closingTable_(b); });   // checks every slide has its table
  Logger.log('Set up. Now deploy as a Web app (Execute as Me, Anyone), then run showClosingScoresLink.');
}

/** Prints the link to paste into the board's Settings. */
function showClosingScoresLink() {
  var key = PropertiesService.getScriptProperties().getProperty('closingKey');
  if (!key) throw new Error('Run setupClosingScores first.');
  var url = ScriptApp.getService().getUrl() || '';
  if (/\/exec$/.test(url)) {
    Logger.log('Paste this into the board (☰ → Settings → Closing scores link):\n' + url + '?k=' + key);
  } else {
    Logger.log('Copy the Web app URL from Deploy → Manage deployments (it ends in /exec), then add this to the end:\n?k=' + key +
               '\nand paste the whole thing into the board (☰ → Settings → Closing scores link).');
  }
}
