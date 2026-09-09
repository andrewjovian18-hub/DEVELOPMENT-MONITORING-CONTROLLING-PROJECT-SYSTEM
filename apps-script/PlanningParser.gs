/** Explicit block contract, not a heuristic parser. Row coordinates are transient write addresses. */
function planningDefaults_() {
  return [
    ['PLANNING_SPREADSHEET_ID', '', 'Required: source workbook ID'],
    ['PLANNING_SHEET_NAME', '', 'Required: source tab name'],
    ['PLANNING_HEADER_ROW', 1, 'One-based header row'],
    ['PLANNING_PROFILE', 'GENERIC', 'GENERIC or SRO_2026 narrative layout'],
    ['PLANNING_LAYOUT_JSON', JSON.stringify(sro2026Layout_()), 'SRO_2026 column/row layout; ID column O reserved only after approval'],
    ['PLANNING_PROJECT_MAP_JSON', '{}', 'Exact source location -> active Project_ID'],
    ['PLANNING_DATE_YEAR', '', 'Explicit year for missing/two-digit metadata dates; no automatic inference'],
    ['PLANNING_INITIAL_ACTUAL', 'ZERO', 'ZERO, BLANK or SOURCE_ONCE; migration policy for new records only'],
    ['PLANNING_PUSHBACK_ENABLED', false, 'Enable only after source Editor access and pilot verification'],
    ['PLANNING_PROVISION_IDS', false, 'Optional Editor mode: persist UUID on new DESIGN rows in dedicated ID column'],
    ['PLANNING_COLUMNS_JSON', JSON.stringify({id: 'Planning_Sync_ID', project: 'Project_ID', item: 'Request_Item', location: 'Store_Location', issuer: 'Issuer', requestDate: 'Request_Date', roDate: 'RO_Date', stage: 'Stage', progress: 'Progress', duration: 'Duration', start: 'Start', finish: 'Finish'}), 'Header labels; optional metadata labels may be null'],
    ['PLANNING_STAGES_JSON', JSON.stringify(['DESIGN', 'APPROVAL', 'TENDER', 'EXECUTION', 'COMPLETED']), 'Ordered stage labels; TENDER and EXECUTION must retain these names']
  ];
}

function planningConfig_(ss) {
  var cfg = {spreadsheetId: setting_(ss, 'PLANNING_SPREADSHEET_ID'), sheetName: setting_(ss, 'PLANNING_SHEET_NAME'), headerRow: Number(setting_(ss, 'PLANNING_HEADER_ROW'))};
  try { cfg.columns = JSON.parse(setting_(ss, 'PLANNING_COLUMNS_JSON')); cfg.stages = JSON.parse(setting_(ss, 'PLANNING_STAGES_JSON')); }
  catch (error) { throw new Error('PLANNING_STRUCTURE_CHANGED: invalid JSON mapping'); }
  if (!cfg.spreadsheetId || !cfg.sheetName || !Number.isInteger(cfg.headerRow) || cfg.headerRow < 1) throw new Error('PLANNING_STRUCTURE_CHANGED: configure source workbook, tab and header row');
  if (!Array.isArray(cfg.stages) || cfg.stages.indexOf('TENDER') < 0 || cfg.stages.indexOf('EXECUTION') < 0 || new Set(cfg.stages).size !== cfg.stages.length) throw new Error('PLANNING_STRUCTURE_CHANGED: invalid stage list');
  cfg.profile = setting_(ss, 'PLANNING_PROFILE'); cfg.timezone = ss.getSpreadsheetTimeZone();
  if (['GENERIC', 'SRO_2026'].indexOf(cfg.profile) < 0) throw new Error('PLANNING_STRUCTURE_CHANGED: unknown profile');
  try { cfg.layout = JSON.parse(setting_(ss, 'PLANNING_LAYOUT_JSON')); cfg.projectMap = JSON.parse(setting_(ss, 'PLANNING_PROJECT_MAP_JSON')); }
  catch (error) { throw new Error('PLANNING_STRUCTURE_CHANGED: invalid layout/project mapping JSON'); }
  if (!cfg.projectMap || typeof cfg.projectMap !== 'object' || Array.isArray(cfg.projectMap)) throw new Error('INVALID_PROJECT: invalid mapping');
  cfg.dateYear = setting_(ss, 'PLANNING_DATE_YEAR');
  return cfg;
}

function parsePlanning_(values, cfg) {
  if (cfg.profile === 'SRO_2026') return parseSro2026_(values, cfg, false);
  var header = values[cfg.headerRow - 1];
  if (!header) throw new Error('PLANNING_STRUCTURE_CHANGED: header row missing');
  var columns = {}, required = ['id', 'project', 'item', 'stage', 'progress', 'duration', 'start', 'finish'];
  Object.keys(cfg.columns).forEach(function (key) {
    var label = cfg.columns[key];
    if (label === null && required.indexOf(key) < 0) return;
    var matches = header.map(function (v, i) { return String(v).trim() === label ? i : -1; }).filter(function (i) { return i >= 0; });
    if (!label || matches.length !== 1) throw new Error('PLANNING_STRUCTURE_CHANGED: missing/duplicate header ' + label);
    columns[key] = matches[0];
  });
  required.forEach(function (key) { if (columns[key] === undefined) throw new Error('PLANNING_STRUCTURE_CHANGED: unmapped ' + key); });
  if (new Set(Object.keys(columns).map(function (k) { return columns[k]; })).size !== Object.keys(columns).length) throw new Error('PLANNING_STRUCTURE_CHANGED: overlapping columns');
  var blocks = [], seen = Object.create(null), current = null;
  function finishBlock() {
    if (!current) return;
    // New Planning requests may still be at DESIGN/APPROVAL. They must not stop the poller.
    if (!current.stages.TENDER) current.stages.TENDER = {progress: ''};
    if (current.stages.TENDER.progress === 1 && !current.stages.EXECUTION) throw new Error('PLANNING_STRUCTURE_CHANGED: completed Tender requires an EXECUTION row (baseline may be blank) for ' + current.id);
    if (current.stages.TENDER.progress === 1 && (!current.project || !current.item)) throw new Error('PLANNING_STRUCTURE_CHANGED: missing project/item for ' + current.id);
    blocks.push(current); current = null;
  }
  values.slice(cfg.headerRow).forEach(function (row, offset) {
    if (row.every(function (v) { return v === ''; })) { finishBlock(); return; }
    var stage = String(row[columns.stage] || '').trim();
    if (cfg.stages.indexOf(stage) < 0) throw new Error('PLANNING_STRUCTURE_CHANGED: unknown/blank stage at source row ' + (cfg.headerRow + offset + 1));
    var id = String(row[columns.id] || '').trim();
    if (id && (!current || id !== current.id)) {
      finishBlock();
      if (seen[id]) throw new Error('DUPLICATE_RECORD: Planning_Sync_ID ' + id);
      seen[id] = true; current = {id: id, stages: {}, project: '', item: ''};
    }
    if (!current) throw new Error('SYNC_ID_NOT_FOUND: source row ' + (cfg.headerRow + offset + 1));
    if (current.stages[stage]) throw new Error('PLANNING_STRUCTURE_CHANGED: duplicate stage ' + stage + ' for ' + current.id);
    ['project', 'item', 'location', 'issuer', 'requestDate', 'roDate'].forEach(function (key) {
      var value = columns[key] === undefined ? '' : row[columns[key]];
      if (value === '' || value === undefined) return;
      if (typeof value === 'string' && (value.length > 2000 || value.charAt(0) === '=')) throw new Error('INVALID_VALUE: source ' + key + ' must be plain text up to 2000 characters');
      if (current[key] !== undefined && current[key] !== '' && String(current[key]) !== String(value)) throw new Error('PLANNING_STRUCTURE_CHANGED: conflicting ' + key + ' for ' + current.id);
      current[key] = value;
    });
    current.stages[stage] = {row: cfg.headerRow + offset + 1, progress: row[columns.progress], duration: row[columns.duration], start: row[columns.start], finish: row[columns.finish]};
  });
  finishBlock();
  blocks.forEach(function (b) { validateProgress_(b.stages.TENDER.progress, true); });
  return {blocks: blocks, columns: columns};
}

function readPlanning_(ss) {
  var cfg = planningConfig_(ss), source = SpreadsheetApp.openById(cfg.spreadsheetId);
  if (source.getId() === ss.getId()) throw new Error('PLANNING_STRUCTURE_CHANGED: use a separate Planning workbook');
  if (source.getSpreadsheetTimeZone() !== ss.getSpreadsheetTimeZone()) throw new Error('INVALID_DATE: Planning and monitoring time zones must match');
  var sheet = source.getSheetByName(cfg.sheetName);
  if (!sheet) throw new Error('PLANNING_STRUCTURE_CHANGED: source tab missing');
  var parsed = parsePlanning_(sheet.getDataRange().getValues(), cfg);
  return {cfg: cfg, sheet: sheet, blocks: parsed.blocks, columns: parsed.columns};
}

/** Optional Editor mode: persist keys ONCE in a dedicated source column, never derive from position/item. */
function provisionPlanningIds_(ss) {
  var cfg = planningConfig_(ss), source = SpreadsheetApp.openById(cfg.spreadsheetId);
  if (source.getId() === ss.getId()) throw new Error('PLANNING_STRUCTURE_CHANGED: source must be separate');
  if (source.getSpreadsheetTimeZone() !== ss.getSpreadsheetTimeZone()) throw new Error('INVALID_DATE: source time zone differs');
  var sheet = source.getSheetByName(cfg.sheetName);
  if (!sheet) throw new Error('PLANNING_STRUCTURE_CHANGED: source tab missing');
  var values = sheet.getDataRange().getValues(), copy = values.map(function (r) { return r.slice(); });
  if (cfg.profile === 'SRO_2026') return provisionSro2026Ids_(ss, cfg, sheet, values);
  var header = copy[cfg.headerRow - 1] || [], idColumn = header.indexOf(cfg.columns.id), stageColumn = header.indexOf(cfg.columns.stage), cells = [];
  if (idColumn < 0 || stageColumn < 0) throw new Error('PLANNING_STRUCTURE_CHANGED: ID/stage header missing');
  copy.slice(cfg.headerRow).forEach(function (r, i) {
    if (r[stageColumn] === cfg.stages[0] && r[idColumn] === '') {
      r[idColumn] = 'PLAN-' + Utilities.getUuid();
      cells.push({row: cfg.headerRow + i + 1, column: idColumn, value: r[idColumn]});
    }
  });
  parsePlanning_(copy, cfg); // Validate the entire proposed structure before any source write.
  if (!cells.length) return;
  if (JSON.stringify(sheet.getDataRange().getValues()) !== JSON.stringify(values)) throw new Error('PLANNING_STRUCTURE_CHANGED: source changed during ID provisioning; retry');
  syncLog_(ss, cells.map(function (c) { return {key: c.value, direction: 'SYSTEM_TO_PLANNING', field: 'ID_PROVISION_INTENT', value: c.value}; }));
  writePlanningCells_({cfg: cfg, sheet: sheet}, cells);
}
