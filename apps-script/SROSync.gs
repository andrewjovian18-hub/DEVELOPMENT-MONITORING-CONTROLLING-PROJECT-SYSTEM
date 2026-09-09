function setupSroPilot() {
  setupFoundation();
  return withFoundationLock_(function () {
    var ss = workbook_(); requireAdmin_(ss);
    seedMissing_(ss.getSheetByName('90_SETTINGS'), planningDefaults_(), function (r) { return r[0]; });
    assertSroClean_(sroTable_(ss), sroSnapshots_(ss));
    installSroEditTrigger_(ss);
    PropertiesService.getDocumentProperties().setProperty('SRO_PILOT_ENABLED', 'true');
    applySroProtections_(ss);
    return 'SRO pilot enabled. Configure Planning settings, then run planningSyncJob. Polling is enabled separately; existing schedules are unchanged.';
  });
}

function planningSyncJob() {
  return withFoundationLock_(function () {
    var ss = workbook_(), actor = syncActor_(ss), now = new Date();
    try {
      var before = sroTable_(ss); assertSroClean_(before, sroSnapshots_(ss));
      if (setting_(ss, 'PLANNING_PROVISION_IDS') === true) provisionPlanningIds_(ss);
      var planning = readPlanning_(ss), cfg = progressConfig_(ss);
      var initialActual = setting_(ss, 'PLANNING_INITIAL_ACTUAL');
      if (['ZERO', 'BLANK', 'SOURCE_ONCE'].indexOf(initialActual) < 0) throw new Error('INVALID_SETTING: PLANNING_INITIAL_ACTUAL');
      var projects = rows_(ss.getSheetByName('10_PROJECT_MASTER'));
      var records = before.map(function (r) { return Object.assign({}, r); });
      var byKey = Object.create(null), entries = [];
      records.forEach(function (r) { byKey[r.Planning_Sync_ID] = r; });
      // Validate all qualifying blocks before allocating any IDs or mutating the workbook.
      planning.blocks.forEach(function (b) {
        if (b.stages.TENDER.progress !== 1) return;
        if (!projects.some(function (r) { return r[0] === b.project && r[10] === true; })) throw new Error('INVALID_PROJECT: ' + b.project);
        if (!byKey[b.id] && initialActual === 'SOURCE_ONCE') validateProgress_(b.stages.EXECUTION.progress, true);
        baselineState_(b.stages.EXECUTION.start, b.stages.EXECUTION.finish, b.stages.EXECUTION.duration, cfg.timezone);
        ['requestDate', 'roDate'].forEach(function (f) { if (b[f] !== undefined) assertDate_(b[f], f); });
        if (byKey[b.id] && byKey[b.id].Project_ID !== b.project) throw new Error('BASELINE_MISMATCH: source project changed for ' + b.id);
      });
      var newIds = reserveSroIds_(ss, before, planning.blocks.filter(function (b) { return b.stages.TENDER.progress === 1 && !byKey[b.id]; }).length, now);
      var nextNewId = 0;
      planning.blocks.forEach(function (b) {
        var record = byKey[b.id], creating = !record;
        if (b.stages.TENDER.progress !== 1) {
          if (record) { record.Sync_Status = 'ERROR'; entries.push({id: record.SRO_ID, key: b.id, error: 'TENDER_NOT_COMPLETE: source no longer qualifies; existing SRO retained without importing baseline'}); }
          return;
        }
        if (creating) {
          record = {}; PMCS.schemas['01_SRO'].forEach(function (h) { record[h] = ''; });
          record.SRO_ID = newIds[nextNewId++]; record.Planning_Sync_ID = b.id;
          record.Actual_Progress = initialActual === 'SOURCE_ONCE' ? b.stages.EXECUTION.progress : initialActual === 'BLANK' ? '' : 0;
          record.Verification_Status = record.Actual_Progress === 1 ? 'WAITING VERIFICATION' : 'NOT READY'; record.Revision_Status = 'NONE';
          records.push(record); byKey[b.id] = record;
        }
        var old = Object.assign({}, record), execution = b.stages.EXECUTION;
        Object.assign(record, {Project_ID: b.project, Store_Location: b.location || '', Request_Item: b.item, Issuer: b.issuer || '', Request_Date: b.requestDate || '', RO_Date: b.roDate || '', Tender_Progress: b.stages.TENDER.progress, Tender_Status: b.stages.TENDER.progress === 1 ? 'COMPLETED' : 'IN PROGRESS'});
        record.Current_Start = execution.start; record.Current_Finish = execution.finish; record.Execution_Duration_Source = execution.duration;
        if (baselineState_(execution.start, execution.finish, execution.duration, cfg.timezone) === 'VALID' && record.Original_Start === '' && record.Original_Finish === '') {
          record.Original_Start = execution.start; record.Original_Finish = execution.finish;
        }
        recalculateSro_(record, now, cfg);
        // Do not acknowledge a failed/pending outbound write merely because inbound sync succeeded.
        if (record.Sync_Status !== 'ERROR' && record.Sync_Status !== 'PENDING') record.Sync_Status = 'SUCCESS';
        var changed = PMCS.schemas['01_SRO'].some(function (h) { return !sameSroValue_(old[h], record[h]); });
        if (changed) {
          stampRecord_(record, creating, actor, now);
          entries.push({time: now, id: record.SRO_ID, key: b.id, field: 'Metadata/Baseline', old: JSON.stringify(old), value: JSON.stringify(record)});
        }
      });
      var incoming = new Set(planning.blocks.map(function (b) { return b.id; }));
      records.forEach(function (r) {
        if (!incoming.has(r.Planning_Sync_ID)) {
          r.Sync_Status = 'ERROR'; stampRecord_(r, false, actor, now);
          entries.push({id: r.SRO_ID, key: r.Planning_Sync_ID, error: 'SYNC_ID_NOT_FOUND: source block missing; SRO preserved'});
        }
      });
      writeSroRecords_(ss, before, records, actor, 'PLANNING_SYNC', now); syncLog_(ss, entries);
      return {records: records.length, changes: entries.length, errors: entries.filter(function (e) { return e.error; }).length};
    } catch (error) { sroError_(ss, error); throw error; }
  });
}

function sourceBlock_(planning, key) {
  var blocks = planning.blocks.filter(function (b) { return b.id === key; });
  if (blocks.length !== 1) throw new Error('SYNC_ID_NOT_FOUND: ' + key);
  return blocks[0];
}

function columnA1_(index) {
  var label = ''; for (var n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}

function writePlanningCells_(planning, cells) {
  var name = "'" + planning.cfg.sheetName.replace(/'/g, "''") + "'!";
  cells.forEach(function (cell) { if (planning.sheet.getRange(cell.row, cell.column + 1).getFormula()) throw new Error('PLANNING_STRUCTURE_CHANGED: write target contains a formula'); });
  SpreadsheetApp.flush();
  Sheets.Spreadsheets.Values.batchUpdate({valueInputOption: 'RAW', data: cells.map(function (cell) {
    return {range: name + columnA1_(cell.column) + cell.row, values: [[cell.value]]};
  })}, planning.cfg.spreadsheetId);
}

function pushSroProgress_(ss, record) {
  if (setting_(ss, 'PLANNING_PUSHBACK_ENABLED') !== true) throw new Error('PUSHBACK_DISABLED: actual saved locally; enable only with source Editor access');
  var planning = readPlanning_(ss), block = sourceBlock_(planning, record.Planning_Sync_ID);
  if (block.stages.TENDER.progress !== 1) throw new Error('TENDER_NOT_COMPLETE: push-back blocked');
  if (block.project !== record.Project_ID) throw new Error('BASELINE_MISMATCH: source project changed');
  validateProgress_(record.Actual_Progress, false);
  writePlanningCells_(planning, [{row: block.stages.EXECUTION.row, column: planning.columns.progress, value: record.Actual_Progress}]);
  syncLog_(ss, [{id: record.SRO_ID, key: record.Planning_Sync_ID, direction: 'SRO_TO_PLANNING', field: 'Actual_Progress', old: block.stages.EXECUTION.progress, value: record.Actual_Progress}]);
}

function retrySroPush(sroId) {
  return withFoundationLock_(function () {
    var ss = workbook_(); requireAdmin_(ss);
    var records = sroTable_(ss); assertSroClean_(records, sroSnapshots_(ss));
    var record = records.find(function (r) { return r.SRO_ID === sroId; });
    if (!record) throw new Error('RECORD_NOT_FOUND: ' + sroId);
    return finishSroPush_(ss, records, record, actor_());
  });
}

function finishSroPush_(ss, records, record, actor) {
  var before = records.map(function (r) { return Object.assign({}, r); }), error;
  try { pushSroProgress_(ss, record); record.Sync_Status = 'SUCCESS'; }
  catch (failure) { record.Sync_Status = 'ERROR'; error = failure; sroError_(ss, failure, record.SRO_ID, record.Planning_Sync_ID, 'SRO_TO_PLANNING'); }
  stampRecord_(record, false, actor, new Date());
  writeSroRecords_(ss, before, records, actor, 'SYSTEM', new Date());
  if (error) throw error;
  return record.SRO_ID;
}

function recalculateSroPilot() {
  return withFoundationLock_(function () {
    var ss = workbook_(), actor = requireAdmin_(ss), before = sroTable_(ss), now = new Date(), cfg = progressConfig_(ss);
    assertSroClean_(before, sroSnapshots_(ss));
    var after = before.map(function (r) { return recalculateSro_(Object.assign({}, r), now, cfg); });
    writeSroRecords_(ss, before, after, actor, 'SYSTEM', now);
  });
}
