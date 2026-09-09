/** Run from a container-bound script in the intended workbook. Rerunnable, never clears records. */
function setupFoundation() {
  return withFoundationLock_(function () {
    var ss = workbook_();
    var existingUsers = ss.getSheetByName('12_USER_MASTER');
    var actor = existingUsers && rows_(existingUsers).length ? requireAdmin_(ss) : actor_();
    // Validate EVERY existing schema before making any changes.
    Object.keys(PMCS.schemas).forEach(function (name) {
      var sheet = ss.getSheetByName(name);
      if (sheet && sheet.getLastRow()) {
        var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), PMCS.schemas[name].length)).getValues()[0];
        if (JSON.stringify(headers) !== JSON.stringify(PMCS.schemas[name])) throw new Error('SCHEMA_MISMATCH: ' + name);
      }
    });
    Object.keys(PMCS.schemas).sort().forEach(function (name) {
      var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
      var headers = PMCS.schemas[name];
      if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
      if (!sheet.getLastRow()) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setBackground('#17365D').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
      sheet.setColumnWidths(1, headers.length, 160);
      sheet.setRowHeight(1, 44);
    });
    seedMissing_(ss.getSheetByName('90_SETTINGS'), foundationSettings_(), function (r) { return r[0]; });
    seedMissing_(ss.getSheetByName('13_STATUS_MASTER'), foundationStatuses_(), function (r) { return r[0] + ':' + r[1]; });
    var users = ss.getSheetByName('12_USER_MASTER');
    if (!rows_(users).length) {
      users.getRange(2, 1, 1, 5).setValues([[nextId_(ss, 'User', new Date()), 'Bootstrap Admin', actor, 'Admin', true]]);
    }
    var capacity = Number(setting_(ss, 'FOUNDATION_ROWS'));
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 20000) throw new Error('INVALID_SETTING: FOUNDATION_ROWS must be 1..20000');
    Object.keys(PMCS.schemas).forEach(function (name) { ensureRows_(ss.getSheetByName(name), capacity + 1); });
    refreshFoundationValidation_(ss);
    applyFoundationProtections_(ss);
    ss.getSheetByName('00_DASHBOARD').setHiddenGridlines(true);
    ss.setActiveSheet(ss.getSheetByName('00_DASHBOARD'));
    auditRows_(ss, [[new Date(), actor, 'FOUNDATION', ss.getId(), 'setup', '', 'Foundation initialized/refreshed', 'SYSTEM']]);
    return 'Foundation ready. No workflow engines or scheduled triggers installed.';
  });
}

function ensureRows_(sheet, count) {
  if (sheet.getMaxRows() < count) sheet.insertRowsAfter(sheet.getMaxRows(), count - sheet.getMaxRows());
}

function seedMissing_(sheet, seeds, keyOf) {
  var existing = {};
  rows_(sheet).forEach(function (r) {
    if (existing[keyOf(r)]) throw new Error('DUPLICATE_RECORD: ' + keyOf(r));
    existing[keyOf(r)] = true;
  });
  var additions = seeds.filter(function (r) { return !existing[keyOf(r)]; });
  if (additions.length) {
    ensureRows_(sheet, sheet.getLastRow() + additions.length);
    sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, additions[0].length).setValues(additions);
  }
}
