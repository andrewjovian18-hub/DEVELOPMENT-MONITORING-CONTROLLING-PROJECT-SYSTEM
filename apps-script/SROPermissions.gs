function applySroProtections_(ss) {
  var sheet = ss.getSheetByName('01_SRO'), headers = PMCS.schemas['01_SRO'];
  var users = rows_(ss.getSheetByName('12_USER_MASTER')).filter(function (r) { return r[4] === true; });
  var admins = users.filter(function (r) { return r[3] === 'Admin'; }).map(function (r) { return String(r[2]); });
  var base = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(function (p) { return p.getDescription() === 'PMCS:foundation:01_SRO'; });
  if (!base) throw new Error('FOUNDATION_REQUIRED');
  var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  var allowed = sroFields_('Admin'), ranges = [];
  allowed.forEach(function (field) {
    var range = sheet.getRange(2, headers.indexOf(field) + 1, sheet.getMaxRows() - 1, 1);
    ranges.push(range);
    var description = 'PMCS:sro-input:' + field;
    var protection = existing.find(function (p) { return p.getDescription() === description; }) || range.protect().setDescription(description);
    protection.setRange(range).setWarningOnly(false);
    var editors = users.filter(function (r) { return sroFields_(r[3]).indexOf(field) >= 0; }).map(function (r) { return String(r[2]); });
    protection.addEditors(editors.concat(admins));
    var unwanted = protection.getEditors().map(function (u) { return u.getEmail(); }).filter(function (email) { return editors.indexOf(email) < 0 && admins.indexOf(email) < 0; });
    if (unwanted.length) protection.removeEditors(unwanted);
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  });
  base.setUnprotectedRanges(ranges);
}

function refreshSroPilotAccess() {
  return withFoundationLock_(function () { var ss = workbook_(); requireAdmin_(ss); applySroProtections_(ss); });
}

function syncActor_(ss) {
  // Time-driven triggers run as their installer; never treat that identity as a human edit author.
  var email = Session.getEffectiveUser().getEmail().toLowerCase();
  if (!email || !rows_(ss.getSheetByName('12_USER_MASTER')).some(function (r) { return String(r[2]).toLowerCase() === email && r[3] === 'Admin' && r[4] === true; })) throw new Error('PERMISSION_DENIED: sync requires active Admin');
  return email;
}

function enablePlanningAutoSync() {
  return withFoundationLock_(function () {
    var ss = workbook_(); requireAdmin_(ss);
    if (setting_(ss, 'PLANNING_PROVISION_IDS') === true) provisionPlanningIds_(ss);
    readPlanning_(ss);
    var owner = PropertiesService.getDocumentProperties().getProperty('SRO_TRIGGER_OWNER');
    if (!owner || owner !== Session.getEffectiveUser().getEmail().toLowerCase()) throw new Error('PERMISSION_DENIED: enable polling as the SRO pilot trigger installer');
    var minutes = Number(setting_(ss, 'PLANNING_SYNC_INTERVAL'));
    if ([1, 5, 10, 15, 30].indexOf(minutes) < 0) throw new Error('INVALID_SETTING: PLANNING_SYNC_INTERVAL must be 1, 5, 10, 15 or 30 minutes');
    var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'planningSyncJob'; });
    // Create first so a quota/authorization failure leaves the previous schedule intact.
    ScriptApp.newTrigger('planningSyncJob').timeBased().everyMinutes(minutes).create();
    existing.forEach(function (t) { ScriptApp.deleteTrigger(t); });
    return 'Planning sync enabled every ' + minutes + ' minutes';
  });
}

function disablePlanningAutoSync() {
  requireAdmin_(workbook_());
  ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'planningSyncJob'; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
