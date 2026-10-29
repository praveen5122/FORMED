/** Region / HQ / L2-L1-L0 / stockist data from the Weekly Sales Tracker (read only). */

/* ================= stockist master ================= */

function trackerSheet_(name) {
  var sh = SpreadsheetApp.openById(CFG.TRACKER_ID).getSheetByName(name);
  if (!sh) throw new Error('Weekly Sales Tracker tab "' + name + '" not found');
  return sh.getDataRange().getValues();
}

// Stockist Sr for an Assignments row: exact name, else same HQ + first word of name.
function matchSr_(list, hq, name) {
  var n = letters_(name), h = norm_(hq), first = norm_(name).split(' ')[0], i;
  for (i = 0; i < list.length; i++) if (letters_(list[i].name) === n) return list[i].sr;
  for (i = 0; i < list.length; i++) if (norm_(list[i].hq) === h && norm_(list[i].name).split(' ')[0] === first) return list[i].sr;
  return '';
}

function getBootstrap() {
  return cached_('boot_dist_v1', function () {
    var st = trackerSheet_('Stockists'), list = [];
    for (var i = 1; i < st.length; i++) list.push({ sr: String(st[i][0]).trim(), hq: String(st[i][2]), name: String(st[i][8]) });

    var a = trackerSheet_('Assignments'), rows = [];
    for (var j = 1; j < a.length; j++) {
      var r = a[j];
      if (!r[1]) continue;
      var stockist = String(r[5]).trim();
      rows.push({
        region: String(r[0]).trim(), hq: String(r[1]).trim(),
        l2: String(r[2]).trim(), l1: String(r[3]).trim(), l0: String(r[4]).trim(),
        stockist: isReal_(stockist) ? stockist : '',
        sr: isReal_(stockist) ? matchSr_(list, r[1], stockist) : ''
      });
    }
    return { rows: rows, month: month_() };
  });
}
