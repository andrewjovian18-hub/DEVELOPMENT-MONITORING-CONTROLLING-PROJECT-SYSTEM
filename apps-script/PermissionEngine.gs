/** Foundation defaults to Admin-only writes until operational handlers are available. */
function applyFoundationProtections_(ss) {
  var admins = rows_(ss.getSheetByName('12_USER_MASTER')).filter(function (r) { return r[3] === 'Admin' && r[4] === true; }).map(function (r) { return String(r[2]); });
  if (!admins.length) throw new Error('PERMISSION_DENIED: at least one Admin required');
  Object.keys(PMCS.schemas).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    var description = 'PMCS:foundation:' + name;
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).filter(function (p) { return p.getDescription() === description; });
    var protection = protections[0] || sheet.protect().setDescription(description);
    protection.setWarningOnly(false);
    protection.addEditors(admins);
    var unwanted = protection.getEditors().filter(function (u) { return admins.map(function (e) { return e.toLowerCase(); }).indexOf(u.getEmail().toLowerCase()) < 0; });
    if (unwanted.length) protection.removeEditors(unwanted.map(function (u) { return u.getEmail(); }));
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
    protection.setUnprotectedRanges([]);
    protections.slice(1).forEach(function (p) { p.remove(); });
    PMCS.schemas[name].forEach(function (field, i) {
      if (['Created_At', 'Created_By', 'Updated_At', 'Updated_By', 'Planning_Sync_ID', 'Sync_Status', 'Escalation_Level', 'Last_Reminder'].indexOf(field) >= 0) sheet.hideColumns(i + 1);
    });
    if (/^(20|21|22|23|98|99)_/.test(name)) sheet.hideSheet();
  });
  if (PropertiesService.getDocumentProperties().getProperty('SRO_PILOT_ENABLED') === 'true') applySroProtections_(ss);
}
