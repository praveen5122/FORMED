/** Small shared helpers: name normalising, cache, sheet and Drive-folder helpers. */

/* ================= helpers ================= */

function norm_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function letters_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function isReal_(s) { var t = norm_(s); return t && t !== 'VACANT' && t !== 'NILL' && t !== 'NIL'; }
function month_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM'); }
function num_(v) { var n = Number(String(v === null || v === undefined ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }

function sameName_(a, b) {
  var x = norm_(a).split(' '), y = norm_(b).split(' ');
  if (!x[0] || !y[0]) return false;
  var n = Math.min(x.length, y.length);
  for (var i = 0; i < n; i++) if (x[i] !== y[i]) return false;
  return n >= 2 || x.length === y.length;
}

function cached_(key, fn) {
  var c = CacheService.getScriptCache(), hit = c.get(key);
  if (hit) return JSON.parse(hit);
  var val = fn();
  try { c.put(key, JSON.stringify(val), CFG.CACHE_SECS); } catch (e) { /* too big: skip cache */ }
  return val;
}

function ensureSheet_(name, headers) {
  var ss = SpreadsheetApp.openById(CFG.DB_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    var first = ss.getSheets()[0];
    if (ss.getSheets().length === 1 && first.getLastRow() === 0 && first.getName() === 'Sheet1') { sh = first; sh.setName(name); }
    else sh = ss.insertSheet(name);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function podFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('POD_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate */ } }
  var it = DriveApp.getFoldersByName(CFG.POD_FOLDER);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(CFG.POD_FOLDER);
  props.setProperty('POD_FOLDER_ID', f.getId());
  return f;
}
