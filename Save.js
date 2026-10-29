/** Validation and saving of a distribution entry + POD files. */

/* ================= save ================= */

function submitDistribution(p) {
  // ---- validate (server side; never trust the browser) ----
  ['entryId', 'region', 'role', 'submitter', 'hq', 'doctor', 'chemist'].forEach(function (f) {
    if (!p[f] || !String(p[f]).trim()) throw new Error('Missing field: ' + f);
  });
  if (!p.lines || !p.lines.length) throw new Error('No product lines');
  var pods = p.pods || (p.pod ? [p.pod] : []);
  if (!pods.length) throw new Error('POD attachment is required');
  if (pods.length > CFG.POD_MAX_FILES) throw new Error('Attach at most ' + CFG.POD_MAX_FILES + ' POD files');
  var total = 0;
  var podBlobs = pods.map(function (f) {
    var ext = CFG.POD_TYPES[f && f.mime];
    if (!ext) throw new Error('POD must be a PDF, JPG or PNG file');
    if (!f.base64) throw new Error('POD file is empty');
    var b = Utilities.base64Decode(f.base64);
    if (!b.length) throw new Error('POD file is empty');
    if (b.length > CFG.POD_MAX_BYTES) throw new Error('POD file "' + f.name + '" is larger than 20 MB');
    total += b.length;
    return { bytes: b, mime: f.mime, ext: ext };
  });
  if (total > CFG.POD_MAX_TOTAL) throw new Error('POD files together are larger than 25 MB');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var files = [];
  try {
    var byProduct = {}, month = month_(), loaded = {};   // fresh numbers at save time, per stockist
    p.lines.forEach(function (l) {
      if (!l.stockist) throw new Error('Missing stockist on a product line');
      var sk = (l.sr || '') + '|' + letters_(l.stockist);
      if (loaded[sk]) return;
      loaded[sk] = 1;
      var av = getAvailability(l.sr || '', l.stockist);
      month = av.month;
      av.products.forEach(function (a) { byProduct[sk + '|' + norm_(a.product)] = a; });
    });

    var rows = [], lineKey = [], any = false;
    p.lines.forEach(function (l) {
      var sk = (l.sr || '') + '|' + letters_(l.stockist);
      var a = byProduct[sk + '|' + norm_(l.product)];
      var f = Number(l.free);
      if (!isFinite(f) || f < 0 || f % 1) throw new Error(l.product + ': free qty must be a whole number, 0 or more');
      if (f === 0) return;                                    // blank line: skip
      if (!a || a.freeLeft <= 0) throw new Error(l.product + ' has no free quantity for ' + l.stockist);
      if (f > a.freeLeft) throw new Error(l.product + ': free qty ' + f + ' is more than the ' + a.freeLeft + ' left');
      any = true;
      rows.push({ a: a, f: f, stockist: l.stockist, sr: l.sr || '' });
      lineKey.push(letters_(l.stockist) + ':' + norm_(l.product) + ':' + f);
    });
    if (!any) throw new Error('Enter the free quantity given for at least one product');

    // ---- duplicates ----
    var sh = ensureSheet_(CFG.DIST_TAB, DIST_HEADERS), v = sh.getDataRange().getValues();
    var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
      [p.doctor, p.chemist, lineKey.sort().join('|')].map(norm_).join('#')));
    var now = new Date(), cutoff = now.getTime() - CFG.DUP_WINDOW_MIN * 60000;
    for (var i = v.length - 1; i >= 1 && i > v.length - 400; i--) {
      if (String(v[i][0]) === String(p.entryId)) return { id: p.entryId, duplicate: true };
      if (String(v[i][19]) === hash && new Date(v[i][1]).getTime() >= cutoff)
        throw new Error('The same entry was already saved in the last ' + CFG.DUP_WINDOW_MIN + ' minutes');
    }

    // ---- upload POD, then write rows ----
    var safe = letters_(p.chemist).slice(0, 20);
    var folder = podFolder_();
    podBlobs.forEach(function (b, n) {
      files.push(folder.createFile(Utilities.newBlob(b.bytes, b.mime, p.entryId + '_' + safe + '_' + (n + 1) + '.' + b.ext)));
    });
    var fileNames = files.map(function (f) { return f.getName(); }).join('\n');
    var fileLinks = files.map(function (f) { return f.getUrl(); }).join('\n');
    var out = rows.map(function (r) {
      return [p.entryId, now, month, p.region, p.role, p.submitter, p.hq, p.bdm || '',
              r.sr, r.stockist, p.doctor, p.chemist, r.a.product,
              r.a.free, r.a.disc, r.f, 0, fileNames, fileLinks, hash];
    });
    sh.getRange(sh.getLastRow() + 1, 1, out.length, DIST_HEADERS.length).setValues(out);
    return { id: p.entryId, rows: out.length, pods: files.length };
  } catch (e) {
    files.forEach(function (f) { try { f.setTrashed(true); } catch (x) { /* ignore */ } });
    throw e;
  } finally {
    lock.releaseLock();
  }
}
