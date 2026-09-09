function refreshFoundationValidation_(ss) {
  var ranges = {rng_ProjectMaster: '10_PROJECT_MASTER', rng_VendorMaster: '11_VENDOR_MASTER', rng_UserMaster: '12_USER_MASTER', rng_StatusMaster: '13_STATUS_MASTER'};
  Object.keys(ranges).forEach(function (name) {
    var s = ss.getSheetByName(ranges[name]);
    ss.setNamedRange(name, s.getRange(2, 1, s.getMaxRows() - 1, PMCS.schemas[ranges[name]].length));
  });
  var settings = rows_(ss.getSheetByName('90_SETTINGS'));
  var cfg = {cfg_CUTOFF_DAY: 'WEEKLY_CUTOFF_DAY', cfg_CUTOFF_TIME: 'WEEKLY_CUTOFF_TIME', cfg_DELAY_THRESHOLD: 'DELAY_THRESHOLD_PP', cfg_HANDOVER_REMINDER: 'HANDOVER_REMINDER_DAYS', cfg_FOLLOWUP_REMINDER: 'FOLLOWUP_REMINDER_DAYS', cfg_ESCALATION_L1: 'ESCALATION_LEVEL_1', cfg_ESCALATION_L2: 'ESCALATION_LEVEL_2', cfg_STALE_DAYS: 'STALE_UPDATE_DAYS'};
  Object.keys(cfg).forEach(function (name) {
    var row = settings.findIndex(function (r) { return r[0] === cfg[name]; });
    if (row < 0) throw new Error('INVALID_SETTING: ' + cfg[name]);
    ss.setNamedRange(name, ss.getSheetByName('90_SETTINGS').getRange(row + 2, 2));
  });
  var categories = {};
  rows_(ss.getSheetByName('13_STATUS_MASTER')).forEach(function (r) {
    if (!categories[r[0]]) categories[r[0]] = [];
    if (r[2] === true) categories[r[0]].push(String(r[1]));
  });
  Object.keys(categories).forEach(function (category) {
    if (!categories[category].length) throw new Error('INVALID_STATUS: no active values for ' + category);
  });
  var references = {Project_ID: '10_PROJECT_MASTER', Vendor_ID: '11_VENDOR_MASTER', Main_Vendor: '11_VENDOR_MASTER', Supporting_Vendor: '11_VENDOR_MASTER', Vendor: '11_VENDOR_MASTER', User_ID: '12_USER_MASTER'};
  Object.keys(PMCS.schemas).forEach(function (name) {
    if (name === '00_DASHBOARD') return;
    var sheet = ss.getSheetByName(name);
    PMCS.schemas[name].forEach(function (field, index) {
      var range = sheet.getRange(2, index + 1, sheet.getMaxRows() - 1, 1);
      var rule = SpreadsheetApp.newDataValidation().setAllowInvalid(false);
      if (references[field] && references[field] !== name) {
        var source = ss.getSheetByName(references[field]);
        range.setDataValidation(rule.requireValueInRange(source.getRange(2, 1, source.getMaxRows() - 1, 1), true).build());
      } else if (categories[field]) {
        range.setDataValidation(rule.requireValueInList(categories[field], true).build());
      } else if (['Active', 'Quotation_Required', 'Red_Note_Flag', 'Potential_Finding', 'Include_as_Finding', 'Processed', 'Critical_Flag'].indexOf(field) >= 0) {
        range.setDataValidation(rule.requireCheckbox().build());
      } else if (/Progress$/.test(field)) {
        range.setDataValidation(rule.requireNumberBetween(0, 1).build()).setNumberFormat('0.0%');
      } else if (isDateField_(field)) {
        range.setDataValidation(rule.requireDate().build()).setNumberFormat('yyyy-mm-dd');
      }
      if (/_At$|Last_Progress_Update|Last_Reminder|^Timestamp$/.test(field)) range.setNumberFormat('yyyy-mm-dd hh:mm:ss');
    });
  });
}

function isDateField_(field) {
  return /(_Date|_Start|_Finish|_At)$/.test(field) || ['Timestamp', 'Reporting_Cutoff', 'Last_Progress_Update', 'Last_Reminder', 'Sent_At'].indexOf(field) >= 0;
}
