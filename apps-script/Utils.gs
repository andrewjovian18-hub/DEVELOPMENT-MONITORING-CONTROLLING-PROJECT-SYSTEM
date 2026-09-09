function workbook_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('BOUND_WORKBOOK_REQUIRED');
  return ss;
}

function withFoundationLock_(callback) {
  var lock = LockService.getDocumentLock();
  if (!lock) throw new Error('BOUND_WORKBOOK_REQUIRED');
  lock.waitLock(30000);
  try { return callback(); } finally { lock.releaseLock(); }
}

function rows_(sheet) {
  return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function actor_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) throw new Error('PERMISSION_DENIED: active user email unavailable');
  return email.toLowerCase();
}

function requireAdmin_(ss) {
  var actor = actor_();
  var users = ss.getSheetByName('12_USER_MASTER');
  if (!users || !rows_(users).some(function (r) {
    return String(r[2]).toLowerCase() === actor && r[3] === 'Admin' && r[4] === true;
  })) throw new Error('PERMISSION_DENIED: active Admin required');
  return actor;
}

function stampRecord_(record, creating, actor, now) {
  if (creating) { record.Created_At = now; record.Created_By = actor; }
  record.Updated_At = now;
  record.Updated_By = actor;
  return record;
}

function assertDate_(value, field) {
  if (value !== '' && (!(value instanceof Date) || !Number.isFinite(value.getTime()))) {
    throw new Error('INVALID_DATE: ' + field + ' requires a valid Date');
  }
}

function setting_(ss, key) {
  var matches = rows_(ss.getSheetByName('90_SETTINGS')).filter(function (r) { return r[0] === key; });
  if (matches.length !== 1) throw new Error('INVALID_SETTING: ' + key);
  return matches[0][1];
}
