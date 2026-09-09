/** Write-ahead audit entries use Change_Source SYSTEM/USER. No swallowed failures. */
function auditRows_(ss, entries) {
  if (!entries.length) return;
  var sheet = ss.getSheetByName('21_HISTORY_LOG');
  var start = sheet.getLastRow() + 1;
  ensureRows_(sheet, start + entries.length - 1);
  sheet.getRange(start, 1, entries.length, 8).setValues(entries.map(function (row) {
    return row.map(function (v) { return typeof v === 'string' && /^[=+@-]/.test(v) ? "'" + v : v; });
  }));
}
