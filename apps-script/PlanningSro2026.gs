/** Adapter for the inspected narrative SRO-2026 layout. NO is a display number, never an ID. */
function sro2026Layout_() {
  return {headerRow: 4, firstDataRow: 6, idColumn: 15, numberColumn: 1, labelColumns: [2, 3], valueColumn: 5,
    stageColumn: 6, durationColumn: 7, startColumn: 8, finishColumn: 9, progressColumn: 10,
    startStage: 'DATA PREPARATIONS', idHeader: 'Planning_Sync_ID'};
}

function planningDate_(value, timezone, fallbackYear) {
  if (value === '' || value === null || value === undefined) return '';
  if (value instanceof Date) { assertDate_(value, 'Planning date'); return value; }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value > 2958465) throw new Error('INVALID_DATE: invalid Sheets serial');
    return localDateFromDay_(Math.floor(value) - 25569, timezone);
  }
  var months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  var match = String(value).trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]+)(?:\s+(\d{2}|\d{4}))?$/);
  if (!match || months.indexOf(match[2]) < 0) throw new Error('INVALID_DATE: unsupported Planning date ' + value);
  var year = match[3] && match[3].length === 4 ? Number(match[3]) : Number(fallbackYear);
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || (match[3] && match[3].length === 2 && year % 100 !== Number(match[3]))) throw new Error('INVALID_DATE: explicit PLANNING_DATE_YEAR needed for ' + value);
  var month = months.indexOf(match[2]) + 1, day = Number(match[1]);
  var text = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  var result = Utilities.parseDate(text, timezone, 'yyyy-MM-dd');
  if (Utilities.formatDate(result, timezone, 'yyyy-MM-dd') !== text) throw new Error('INVALID_DATE: impossible date ' + value);
  return result;
}

function parseSro2026_(values, cfg, preview) {
  var layout = cfg.layout, timezone = cfg.timezone, header = values[layout.headerRow - 1] || [];
  ['headerRow', 'firstDataRow', 'idColumn', 'numberColumn', 'valueColumn', 'stageColumn', 'durationColumn', 'startColumn', 'finishColumn', 'progressColumn'].forEach(function (key) {
    if (!Number.isInteger(layout[key]) || layout[key] < 1) throw new Error('PLANNING_STRUCTURE_CHANGED: invalid layout ' + key);
  });
  if (!Array.isArray(layout.labelColumns) || !layout.labelColumns.length || layout.labelColumns.some(function (c) { return !Number.isInteger(c) || c < 1; })) throw new Error('PLANNING_STRUCTURE_CHANGED: invalid label columns');
  if (layout.firstDataRow <= layout.headerRow || new Set([layout.idColumn, layout.numberColumn, layout.valueColumn, layout.stageColumn, layout.durationColumn, layout.startColumn, layout.finishColumn, layout.progressColumn].concat(layout.labelColumns)).size !== 8 + layout.labelColumns.length) throw new Error('PLANNING_STRUCTURE_CHANGED: overlapping layout columns');
  var expected = {stageColumn: 'PROCESS', durationColumn: 'DURATION', startColumn: 'START', finishColumn: 'END', progressColumn: 'PROGRESS'};
  Object.keys(expected).forEach(function (key) { if (header[layout[key] - 1] !== expected[key]) throw new Error('PLANNING_STRUCTURE_CHANGED: expected ' + expected[key] + ' header'); });
  var idHeader = header[layout.idColumn - 1] || '';
  if (idHeader && idHeader !== layout.idHeader) throw new Error('PLANNING_STRUCTURE_CHANGED: designated ID column is already in use');
  var blocks = [], current, seen = Object.create(null), warnings = [];
  var stages = [layout.startStage, 'APPROVAL', 'TENDER', 'EXECUTION', 'COMPLETED'];
  var labels = {'STORE / LOCATION': 'location', 'REQUEST ITEM': 'item', ISSUER: 'issuer', 'REQUEST DATE': 'requestDate', 'RO DATE': 'roDate'};
  function finish() {
    if (!current) return;
    current.stages.TENDER = current.stages.TENDER || {progress: ''};
    validateProgress_(current.stages.TENDER.progress, true);
    var qualifies = current.stages.TENDER.progress === 1;
    if (qualifies && (!current.item || !current.location || !current.stages.EXECUTION)) throw new Error('PLANNING_STRUCTURE_CHANGED: incomplete qualifying block at ' + current.sourceRow);
    current.project = Object.prototype.hasOwnProperty.call(cfg.projectMap, current.location) ? cfg.projectMap[current.location] : '';
    if (qualifies && !current.id) warnings.push({row: current.sourceRow, code: 'SYNC_ID_NOT_FOUND'});
    if (qualifies && !current.project) warnings.push({row: current.sourceRow, code: 'PROJECT_MAPPING_REQUIRED'});
    ['requestDate', 'roDate'].forEach(function (key) {
      try { current[key] = planningDate_(current[key], timezone, cfg.dateYear); }
      catch (error) { current.dateErrors = current.dateErrors || []; current.dateErrors.push(String(error)); warnings.push({row: current.sourceRow, code: String(error)}); }
    });
    if (qualifies) {
      var execution = current.stages.EXECUTION;
      try {
        execution.start = planningDate_(execution.start, timezone, cfg.dateYear); execution.finish = planningDate_(execution.finish, timezone, cfg.dateYear);
        baselineState_(execution.start, execution.finish, execution.duration, timezone); validateProgress_(execution.progress, true);
      } catch (error) { current.baselineError = String(error); warnings.push({row: current.sourceRow, code: String(error)}); }
      if (!preview) {
        if (!idHeader || !current.id) throw new Error('SYNC_ID_NOT_FOUND: dedicated Planning_Sync_ID required; NO is not an ID');
        if (!current.project) throw new Error('INVALID_PROJECT: configure exact location mapping for ' + current.location);
        if (current.dateErrors) throw new Error(current.dateErrors.join('; '));
        if (current.baselineError) throw new Error(current.baselineError);
      }
    }
    blocks.push(current); current = null;
  }
  values.slice(layout.firstDataRow - 1).forEach(function (raw, offset) {
    var row = raw.map(function (v) { return v === null ? '' : v; }), rowNumber = layout.firstDataRow + offset;
    function cell(column) { return row[column - 1] === undefined ? '' : row[column - 1]; }
    var stage = String(cell(layout.stageColumn)).trim();
    var label = layout.labelColumns.map(cell).filter(function (v) { return v !== ''; }).join(' ').trim();
    if (!stage) {
      // Source has AVERAGE progress summaries between blocks; never use them as Tender status.
      if (label || cell(layout.valueColumn) !== '' || cell(layout.numberColumn) !== '' || cell(layout.idColumn) !== '' || [layout.durationColumn, layout.startColumn, layout.finishColumn].some(function (c) { return cell(c) !== ''; })) throw new Error('PLANNING_STRUCTURE_CHANGED: unexpected non-stage row ' + rowNumber);
      if (current && !current.stages.COMPLETED) throw new Error('PLANNING_STRUCTURE_CHANGED: separator inside unfinished block ' + rowNumber);
      finish(); return;
    }
    if (stages.indexOf(stage) < 0) throw new Error('PLANNING_STRUCTURE_CHANGED: unknown process ' + stage);
    if (stage === layout.startStage) {
      finish();
      var id = String(cell(layout.idColumn)).trim();
      if (id && seen[id]) throw new Error('DUPLICATE_RECORD: ' + id);
      if (id) seen[id] = true;
      current = {id: id, sourceRow: rowNumber, displayNumber: cell(layout.numberColumn), location: '', item: '', issuer: '', requestDate: '', roDate: '', stages: {}};
    }
    if (!current || current.stages[stage]) throw new Error('PLANNING_STRUCTURE_CHANGED: orphan/duplicate stage at ' + rowNumber);
    if (cell(layout.idColumn) !== '' && String(cell(layout.idColumn)).trim() !== current.id) throw new Error('PLANNING_STRUCTURE_CHANGED: conflicting block ID');
    if (!labels[label]) throw new Error('PLANNING_STRUCTURE_CHANGED: unknown metadata label at ' + rowNumber);
    var value = cell(layout.valueColumn);
    if (typeof value === 'string' && (value.length > 2000 || value.charAt(0) === '=')) throw new Error('INVALID_VALUE: Planning metadata');
    current[labels[label]] = value;
    current.stages[stage] = {row: rowNumber, progress: cell(layout.progressColumn), duration: cell(layout.durationColumn), start: cell(layout.startColumn), finish: cell(layout.finishColumn)};
  });
  finish();
  return {blocks: blocks, warnings: warnings, columns: {id: layout.idColumn - 1, stage: layout.stageColumn - 1, progress: layout.progressColumn - 1, duration: layout.durationColumn - 1, start: layout.startColumn - 1, finish: layout.finishColumn - 1}};
}

function previewPlanningSource() {
  var ss = workbook_(); requireAdmin_(ss);
  var cfg = planningConfig_(ss), source = SpreadsheetApp.openById(cfg.spreadsheetId), sheet = source.getSheetByName(cfg.sheetName);
  if (!sheet) throw new Error('PLANNING_STRUCTURE_CHANGED: source tab missing');
  cfg.timezone = source.getSpreadsheetTimeZone();
  var parsed = cfg.profile === 'SRO_2026' ? parseSro2026_(sheet.getDataRange().getValues(), cfg, true) : parsePlanning_(sheet.getDataRange().getValues(), cfg);
  var result = {total: parsed.blocks.length, tenderComplete: parsed.blocks.filter(function (b) { return b.stages.TENDER.progress === 1; }).length, warnings: parsed.warnings || []};
  console.log(JSON.stringify(result)); return result;
}

function provisionSro2026Ids_() {
  throw new Error('SOURCE_ID_SETUP_REQUIRED: Planning team owns SRO_2026 ID setup; keep PLANNING_PROVISION_IDS FALSE');
}
