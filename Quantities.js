/** Free quantity (CentForce) and discounted quantity (Weekly Sales Tracker) per stockist and product. */

/* ================= quantities ================= */

/**
 * Eligible products for a stockist this month.
 *  free       <- FREE_QTY_MASTER tab (CentForce data, filled by you later)
 *  discounted <- Weekly Sales Tracker > SecondarySales, rows whose Rate Type is not "Default"
 *  left       <- available minus what was already distributed in DISTRIBUTION this month
 */
function getAvailability(sr, stockist) {
  var month = month_(), map = {}, warnings = [];

  function slot(p) {
    var k = norm_(p);
    if (!map[k]) map[k] = { product: String(p).trim(), free: 0, disc: 0, freeUsed: 0, discUsed: 0 };
    return map[k];
  }
  var matchStockist = function (rowSr, rowName) {
    if (sr && String(rowSr).trim() === String(sr)) return true;
    return letters_(rowName) === letters_(stockist);
  };

  // Free qty source 1: CentForce (FREE_QTY_MASTER tab - filled by you when the data is available)
  var fsh = ensureSheet_(CFG.FREE_TAB, FREE_HEADERS), fv = fsh.getDataRange().getValues(), i, haveCentForce = false;
  for (i = 1; i < fv.length; i++) {
    if (String(fv[i][0]).trim() !== month || !fv[i][3]) continue;
    if (matchStockist(fv[i][1], fv[i][2])) { haveCentForce = true; slot(fv[i][3]).free += num_(fv[i][4]); }
  }

  // Discounted qty (Weekly Statement = Weekly Sales Tracker)
  var sv = trackerSheet_('SecondarySales');
  var hdr = sv[0].map(function (h) { return norm_(h); });
  var cMonth = hdr.indexOf('MONTH'), cSr = hdr.indexOf('STOCKIST SR'), cName = hdr.indexOf('STOCKIST'),
      cProd = hdr.indexOf('PRODUCT'), cType = hdr.indexOf('RATE TYPE'), cQty = hdr.indexOf('SECONDARY QTY');
  if ([cMonth, cSr, cName, cProd, cType, cQty].indexOf(-1) !== -1) throw new Error('SecondarySales columns changed - cannot read discounted quantity');
  for (i = 1; i < sv.length; i++) {
    var r = sv[i];
    if (String(r[cMonth]).trim() !== month || !r[cProd]) continue;
    if (norm_(r[cType]) === 'DEFAULT' || !norm_(r[cType])) continue;     // discounted = any non-Default rate type
    if (matchStockist(r[cSr], r[cName])) slot(r[cProd]).disc += num_(r[cQty]);
  }
  if (!haveCentForce) warnings.push('No CentForce free quantity is loaded for this stockist in ' + month + ' (FREE_QTY_MASTER tab).');

  // Already distributed this month (so repeat entries cannot exceed the available qty)
  var dsh = ensureSheet_(CFG.DIST_TAB, DIST_HEADERS), dv = dsh.getDataRange().getValues();
  for (i = 1; i < dv.length; i++) {
    if (String(dv[i][2]).trim() !== month) continue;
    if (!matchStockist(dv[i][8], dv[i][9])) continue;
    var k = norm_(dv[i][12]);
    if (map[k]) { map[k].freeUsed += num_(dv[i][15]); map[k].discUsed += num_(dv[i][16]); }
  }

  var products = Object.keys(map).map(function (k) { return map[k]; })
    .filter(function (p) { return p.free > 0 || p.disc > 0; })
    .map(function (p) {
      return { product: p.product, free: p.free, disc: p.disc,
               freeLeft: Math.max(0, p.free - p.freeUsed), discLeft: Math.max(0, p.disc - p.discUsed) };
    })
    .sort(function (a, b) { return a.product.localeCompare(b.product); });

  return { month: month, products: products, warnings: warnings, freeSource: 'CentForce' };
}

/** Quantities for several stockists at once (everything assigned to the selected L0 / HQ). */
function getAvailabilityMulti(stockists) {
  var out = [], warnings = [], month = month_(), seen = {};
  (stockists || []).forEach(function (s) {
    var key = (s.sr || '') + '|' + letters_(s.name);
    if (!s.name || seen[key]) return;
    seen[key] = 1;
    var a = getAvailability(s.sr || '', s.name);
    month = a.month;
    a.warnings.forEach(function (w) { if (warnings.indexOf(w) === -1) warnings.push(w); });
    a.products.forEach(function (p) {
      out.push({ stockist: s.name, sr: s.sr || '', hq: s.hq || '', product: p.product,
                 free: p.free, disc: p.disc, freeLeft: p.freeLeft, discLeft: p.discLeft });
    });
  });
  var names = [];
  (stockists || []).forEach(function (s) { if (s.name && names.indexOf(s.name) === -1) names.push(s.name); });
  return { month: month, products: out, warnings: warnings, stockists: names };
}
