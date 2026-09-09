function sroFields_(role) {
  var fields = ['Actual_Progress', 'Actual_Start', 'Actual_Finish', 'Issue', 'Mitigation', 'Remarks', 'Proposed_Finish', 'Revision_Reason'];
  return role === 'Site Team' ? fields : role === 'Admin' || role === 'Project Manager' ? fields.concat(['Main_Vendor', 'Supporting_Vendor', 'Revision_Status', 'Verification_Status']) : [];
}

function sroUser_(ss, email, projectId) {
  if (!email) throw new Error('PERMISSION_DENIED: editor identity unavailable');
  var users = rows_(ss.getSheetByName('12_USER_MASTER')).filter(function (r) { return String(r[2]).toLowerCase() === email.toLowerCase() && r[4] === true; });
  if (users.length !== 1 || !sroFields_(users[0][3]).length) throw new Error('PERMISSION_DENIED: active SRO role required');
  var user = users[0];
  if (user[3] !== 'Admin' && !rows_(ss.getSheetByName('14_USER_PROJECT_ACCESS')).some(function (r) { return r[0] === user[0] && r[1] === projectId && r[2] === true; })) throw new Error('PERMISSION_DENIED: project not assigned');
  return user[3];
}

function validateSroPatch_(ss, record, patch, role, now) {
  var updated = Object.assign({}, record), allowed = sroFields_(role);
  Object.keys(patch).forEach(function (field) {
    if (allowed.indexOf(field) < 0) throw new Error('PERMISSION_DENIED: immutable or restricted field ' + field);
    var value = patch[field];
    if (field === 'Actual_Progress') validateProgress_(value, false);
    else if (isDateField_(field)) assertDate_(value, field);
    else if (typeof value !== 'string' || value.length > 2000 || value.charAt(0) === '=') throw new Error('INVALID_VALUE: ' + field);
    updated[field] = value;
  });
  if (record.Lifecycle_Status === 'CLOSED') throw new Error('PERMISSION_DENIED: closed SRO is immutable in the pilot');
  ['Main_Vendor', 'Supporting_Vendor'].forEach(function (field) {
    if (!Object.prototype.hasOwnProperty.call(patch, field) || updated[field] === '') return;
    var matches = rows_(ss.getSheetByName('11_VENDOR_MASTER')).filter(function (r) { return r[0] === updated[field]; });
    if (matches.length !== 1) throw new Error('INVALID_VENDOR: ' + updated[field]);
    if (matches[0][6] !== true) throw new Error('INACTIVE_VENDOR: ' + updated[field]);
  });
  if (updated.Actual_Start !== '' && updated.Actual_Finish !== '' && updated.Actual_Finish < updated.Actual_Start) throw new Error('INVALID_DATE: actual finish precedes actual start');
  if ('Actual_Progress' in patch) {
    updated.Last_Progress_Update = now; updated.Reporting_Status = 'UPDATED'; updated.Sync_Status = 'PENDING';
    if (updated.Actual_Progress === 1 && updated.Verification_Status !== 'VERIFIED') updated.Verification_Status = 'WAITING VERIFICATION';
    if (updated.Actual_Progress < 1) updated.Verification_Status = 'NOT READY';
  }
  if ('Proposed_Finish' in patch || 'Revision_Reason' in patch) updated.Revision_Status = updated.Proposed_Finish !== '' && updated.Revision_Reason.trim() ? 'PENDING' : 'NONE';
  if ('Revision_Status' in patch) {
    if (['APPROVED', 'REJECTED'].indexOf(patch.Revision_Status) < 0 || record.Revision_Status !== 'PENDING' || updated.Proposed_Finish === '' || !updated.Revision_Reason.trim()) throw new Error('INVALID_REVISION: complete pending proposal required');
    if (patch.Revision_Status === 'APPROVED') {
      baselineState_(updated.Current_Start, updated.Proposed_Finish, calendarDay_(updated.Proposed_Finish, ss.getSpreadsheetTimeZone()) - calendarDay_(updated.Current_Start, ss.getSpreadsheetTimeZone()), ss.getSpreadsheetTimeZone());
    }
  }
  if ('Verification_Status' in patch) {
    if (patch.Verification_Status !== 'VERIFIED' || updated.Actual_Progress !== 1 || updated.Actual_Finish === '') throw new Error('INVALID_VERIFICATION: 100% and actual finish required');
    updated.Closed_Date = now;
  }
  return updated;
}

function approveSroBaseline_(ss, old, record) {
  if (setting_(ss, 'PLANNING_PUSHBACK_ENABLED') !== true) throw new Error('PUSHBACK_DISABLED: approval requires Planning Editor access');
  var planning = readPlanning_(ss), block = sourceBlock_(planning, record.Planning_Sync_ID), execution = block.stages.EXECUTION, tz = ss.getSpreadsheetTimeZone();
  if (block.project !== old.Project_ID || block.stages.TENDER.progress !== 1 || !sameSroValue_(execution.start, old.Current_Start) || !sameSroValue_(execution.finish, old.Current_Finish) || execution.duration !== old.Execution_Duration_Source) throw new Error('BASELINE_MISMATCH: sync latest Planning baseline before approval');
  var duration = calendarDay_(record.Proposed_Finish, tz) - calendarDay_(record.Current_Start, tz);
  syncLog_(ss, [{id: record.SRO_ID, key: record.Planning_Sync_ID, direction: 'SRO_TO_PLANNING', field: 'REVISION_INTENT', old: old.Current_Finish, value: record.Proposed_Finish}]);
  var finishFormula = planning.sheet.getRange(execution.row, planning.columns.finish + 1).getFormula().replace(/[\s$]/g, '').toUpperCase();
  var startRef = columnA1_(planning.columns.start) + execution.row, durationRef = columnA1_(planning.columns.duration) + execution.row;
  var cells = [{row: execution.row, column: planning.columns.duration, value: duration}];
  if (finishFormula && finishFormula !== '=' + startRef + '+' + durationRef && finishFormula !== '=' + durationRef + '+' + startRef) throw new Error('PLANNING_STRUCTURE_CHANGED: unsupported finish formula; revision not written');
  // Preserve the inspected Finish=Start+Duration formula; update its duration input only.
  if (!finishFormula) cells.push({row: execution.row, column: planning.columns.finish, value: calendarDay_(record.Proposed_Finish, tz) + 25569});
  writePlanningCells_(planning, cells);
  record.Current_Finish = record.Proposed_Finish; record.Execution_Duration_Source = duration;
  syncLog_(ss, [{id: record.SRO_ID, key: record.Planning_Sync_ID, direction: 'SRO_TO_PLANNING', field: 'Current_Finish', old: old.Current_Finish, value: record.Current_Finish}]);
}

/** Public API for Admin/manual wrappers; installed edit handler shares the same validator. */
function updateSroRecord(sroId, patch) {
  return withFoundationLock_(function () {
    var ss = workbook_(), records = sroTable_(ss); assertSroClean_(records, sroSnapshots_(ss));
    return updateSroLocked_(ss, records, sroId, patch, actor_());
  });
}

function updateSroLocked_(ss, records, sroId, patch, actor) {
  var index = records.findIndex(function (r) { return r.SRO_ID === sroId; });
  if (index < 0) throw new Error('RECORD_NOT_FOUND: ' + sroId);
  var old = records[index], now = new Date(), role = sroUser_(ss, actor, old.Project_ID);
  var cfg = progressConfig_(ss);
  var record = validateSroPatch_(ss, old, patch, role, now);
  if (patch.Revision_Status === 'APPROVED') approveSroBaseline_(ss, old, record);
  recalculateSro_(record, now, cfg); stampRecord_(record, false, actor, now);
  var after = records.slice(); after[index] = record;
  // Persist actual progress and PENDING before contacting the external Planning workbook.
  writeSroRecords_(ss, records, after, actor, 'USER', now);
  if ('Actual_Progress' in patch) finishSroPush_(ss, after, record, actor);
  return sroId;
}

function installSroEditTrigger_(ss) {
  var properties = PropertiesService.getDocumentProperties(), owner = Session.getEffectiveUser().getEmail().toLowerCase();
  var installedBy = properties.getProperty('SRO_TRIGGER_OWNER');
  if (installedBy && installedBy !== owner) throw new Error('PERMISSION_DENIED: rerun trigger setup as ' + installedBy);
  var triggers = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sroOnEdit'; });
  if (!triggers.length) ScriptApp.newTrigger('sroOnEdit').forSpreadsheet(ss).onEdit().create();
  triggers.slice(1).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  properties.setProperty('SRO_TRIGGER_OWNER', owner);
}

/** Single-cell edits only. Restore rejected input from an ID-keyed committed snapshot. */
function sroOnEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== '01_SRO') return;
  return withFoundationLock_(function () {
    var ss = e.source, snapshots = sroSnapshots_(ss), range = e.range, headers = PMCS.schemas['01_SRO'];
    var row = range.getRow(), column = range.getColumn(), actor = e.user ? e.user.getEmail().toLowerCase() : '';
    var sheet = range.getSheet(), id = row > 1 ? sheet.getRange(row, 1).getValues()[0][0] : '', old = snapshots[id];
    var committed = false;
    try {
      if (range.getNumRows() !== 1 || range.getNumColumns() !== 1 || row < 2 || !old) throw new Error('UNSUPPORTED_EDIT: use one input cell on an existing SRO');
      var field = headers[column - 1];
      var current = sroTable_(ss), patch = {}; patch[field] = range.getValues()[0][0];
      // Reconstruct the one accepted change; any other unprocessed edit blocks this write.
      var before = current.map(function (r) { return r.SRO_ID === id ? Object.assign({}, r, (function () { var p = {}; p[field] = old[field]; return p; })()) : r; });
      assertSroClean_(before, snapshots);
      updateSroLocked_(ss, before, id, patch, actor);
      committed = true;
    } catch (error) {
      // Outbound failure already committed the new actual value. Never revert it.
      var latest = sroSnapshots_(ss);
      if (old && latest[id] && JSON.stringify(latest[id]) !== JSON.stringify(old)) committed = true;
      if (!committed) {
        var restore = range.getValues();
        restore.forEach(function (cells, r) {
          var recordId = sheet.getRange(row + r, 1).getValues()[0][0], saved = snapshots[recordId];
          if (row + r === 1) { cells.forEach(function (_, c) { cells[c] = headers[column + c - 1] || ''; }); return; }
          if (!saved) throw new Error('STATE_RECOVERY_REQUIRED: immutable ID missing; inspect version history');
          cells.forEach(function (_, c) { cells[c] = saved[headers[column + c - 1]]; });
        });
        range.setValues(restore);
      }
      sroError_(ss, error, id, old ? old.Planning_Sync_ID : '', 'USER_EDIT');
      ss.toast(String(error), 'SRO edit needs attention', 10);
      throw error;
    }
  });
}
