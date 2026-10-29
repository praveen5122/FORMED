/** Doctors and chemists from CentForce_Master (read only). */

/* ================= doctors / chemists (CentForce_Master) ================= */

/**
 * Which CentForce employee code(s) is this BDM? Exact name only: "Rahul R" must never pull in "Rahul R A".
 * Order: alias table (NAME:<exact name>) -> DIM_Employee exact name -> HQ tie-break -> unique loose match.
 * Ambiguous loose matches return nothing rather than guessing (the form then asks the user to type the doctor).
 */
function resolveEmpCodes_(emp, alias, name, hq) {
  var n = norm_(name), h = norm_(hq), i, live = {}, byCode = {};
  for (i = 1; i < emp.length; i++) {
    if (String(emp[i][12]).toUpperCase() === 'Y') continue;            // Is_Excluded
    live[String(emp[i][0])] = true;
    byCode[String(emp[i][0])] = { name: emp[i][1], hq: emp[i][5] };
  }
  var ov = CFG.EMP_OVERRIDES[n + '|' + h];
  if (ov && live[ov]) return [ov];
  var found = {};
  for (i = 1; i < alias.length; i++) {
    var key = String(alias[i][0]);
    if (key.indexOf('NAME:') === 0 && norm_(key.slice(5)) === n && live[String(alias[i][2])]) found[String(alias[i][2])] = true;
  }
  if (!Object.keys(found).length) {
    for (var c in byCode) if (norm_(byCode[c].name) === n) found[c] = true;
  }
  var codes = Object.keys(found);
  if (codes.length > 1 && h) {
    var same = codes.filter(function (c) { return norm_(byCode[c].hq) === h; });
    if (same.length) codes = same;
  }
  if (codes.length) return codes;

  var loose = Object.keys(byCode).filter(function (c) { return sameName_(byCode[c].name, name); });
  if (loose.length > 1 && h) {
    var near = loose.filter(function (c) { return norm_(byCode[c].hq) === h; });
    if (near.length) loose = near;
  }
  return loose.length === 1 ? loose : [];
}

function getDoctors(bdmName, hq) {
  if (!isReal_(bdmName)) return [];
  return cached_('doc2_' + norm_(bdmName) + '|' + norm_(hq), function () {
    var ss = SpreadsheetApp.openById(CFG.MASTER_ID), i;
    var codes = {};
    bdmCodes_(ss, bdmName, hq).forEach(function (c) { codes[c] = true; });
    if (!Object.keys(codes).length) return [];
    var own = ss.getSheetByName('MAP_Doctor_Owner').getDataRange().getValues(), docCodes = {};
    for (i = 1; i < own.length; i++) if (codes[String(own[i][2])]) docCodes[String(own[i][1])] = true;
    var d = ss.getSheetByName('DIM_Doctor').getDataRange().getValues(), out = [];
    for (i = 1; i < d.length; i++) {
      var c = String(d[i][0]);
      if (docCodes[c]) out.push({ code: c, name: String(d[i][1]), spec: String(d[i][3]) });
    }
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  });
}

// Employee codes for a BDM (shared by the doctor and chemist lookups)
function bdmCodes_(ss, bdmName, hq) {
  return resolveEmpCodes_(ss.getSheetByName('DIM_Employee').getDataRange().getValues(),
                          ss.getSheetByName('MAP_Employee_Alias').getDataRange().getValues(), bdmName, hq);
}

/**
 * Chemists to offer. linked = mapped to this doctor in MAP_Doctor_Chemist (partial data).
 * others = chemists this BDM's doctors are linked to + chemists the BDM last visited (DIM_Customer).
 */
function getChemists(doctorCode, bdmName, hq) {
  var ss = SpreadsheetApp.openById(CFG.MASTER_ID), i, seen = {}, linked = [], others = [];
  var m = ss.getSheetByName('MAP_Doctor_Chemist').getDataRange().getValues();
  function add(list, n) { n = String(n).trim(); if (n && !seen[norm_(n)]) { seen[norm_(n)] = 1; list.push(n); } }
  if (doctorCode) for (i = 1; i < m.length; i++) if (String(m[i][1]) === String(doctorCode)) add(linked, m[i][4]);

  if (isReal_(bdmName)) {
    var rest = cached_('chem2_' + norm_(bdmName) + '|' + norm_(hq), function () {
      var codes = {}, mine = {}, out = [], sn = {};
      bdmCodes_(ss, bdmName, hq).forEach(function (c) { codes[c] = true; });
      if (!Object.keys(codes).length) return [];
      var own = ss.getSheetByName('MAP_Doctor_Owner').getDataRange().getValues();
      for (var j = 1; j < own.length; j++) if (codes[String(own[j][2])]) mine[String(own[j][1])] = true;
      var push = function (n) { n = String(n).trim(); if (n && !sn[norm_(n)]) { sn[norm_(n)] = 1; out.push(n); } };
      for (j = 1; j < m.length; j++) if (mine[String(m[j][1])]) push(m[j][4]);
      var cu = ss.getSheetByName('DIM_Customer').getDataRange().getValues();
      for (j = 1; j < cu.length; j++) if (cu[j][1] === 'Chemist' && codes[String(cu[j][8])]) push(cu[j][3]);
      return out.sort();
    });
    rest.forEach(function (n) { add(others, n); });
  }
  return { linked: linked, others: others };
}
