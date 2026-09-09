const test = require('node:test');
const assert = require('node:assert/strict');
const {environment} = require('./fake-apps-script.cjs');
function fixture() {
  const rows = Array.from({length: 5}, () => Array(15).fill(''));
  rows[2][0] = 'NO'; rows[2][1] = 'REQUEST';
  ['PROCESS', 'DURATION', 'START', 'END', 'PROGRESS'].forEach((h, i) => rows[3][5 + i] = h);
  rows[3][14] = 'Planning_Sync_ID'; rows[4][9] = .9;
  return rows;
}
function append(rows, key, tender = 1, actual = .6, display = 35) {
  const stages = ['DATA PREPARATIONS', 'APPROVAL', 'TENDER', 'EXECUTION', 'COMPLETED'];
  const labels = ['STORE / LOCATION', 'REQUEST ITEM', 'ISSUER', 'REQUEST DATE', 'RO DATE'];
  const vals = ['Synthetic store', 'Synthetic request', 'Test team', '22 JANUARI 2026', 46080];
  stages.forEach((s, i) => {
    const row = Array(15).fill(''); row[i === 0 ? 1 : 2] = labels[i]; row[4] = vals[i]; row[5] = s;
    row[6] = 10; row[7] = 46000; row[8] = 46010; row[9] = s === 'TENDER' ? tender : s === 'EXECUTION' ? actual : 1;
    if (!i) { row[0] = display; row[14] = key; } rows.push(row);
  });
  const summary = Array(15).fill(''); summary[9] = .2; rows.push(summary);
}
function config(e) { return {layout: e.ctx.sro2026Layout_(), timezone: 'Asia/Bangkok', projectMap: {'Synthetic store': 'PRJ-0001'}, dateYear: 2026}; }

test('narrative profile reads E metadata and F:J stages, ignoring duplicate NO and average summaries', () => {
  const e = environment(), v = fixture(); append(v, 'PLAN-A'); append(v, 'PLAN-B', .5);
  const r = e.ctx.parseSro2026_(v, config(e), false);
  assert.equal(r.blocks.length, 2); assert.equal(r.blocks[0].displayNumber, r.blocks[1].displayNumber);
  assert.equal(r.blocks[0].id, 'PLAN-A'); assert.equal(r.blocks[1].id, 'PLAN-B');
  assert.equal(r.blocks[0].stages.EXECUTION.row, 9);
  assert.equal(r.blocks[1].stages.TENDER.progress, .5);
  assert.equal(r.blocks[0].project, 'PRJ-0001');
  assert.equal(e.ctx.calendarDay_(r.blocks[0].requestDate, 'Asia/Bangkok'), Date.parse('2026-01-22') / 86400000);
});

test('Viewer preview returns readiness issues but production never uses display numbers as keys', () => {
  const e = environment(), v = fixture(); append(v, ''); v[3][14] = '';
  const cfg = config(e); cfg.projectMap = {};
  const r = e.ctx.parseSro2026_(v, cfg, true);
  assert.ok(r.warnings.some(w => w.code === 'SYNC_ID_NOT_FOUND'));
  assert.ok(r.warnings.some(w => w.code === 'PROJECT_MAPPING_REQUIRED'));
  assert.throws(() => e.ctx.parseSro2026_(v, cfg, false), /SYNC_ID_NOT_FOUND/);
  assert.throws(() => e.ctx.provisionSro2026Ids_(), /Planning team/);
});

test('Indonesian dates support four-digit years and configured partial years, without guessing', () => {
  const e = environment(), tz = 'Asia/Bangkok';
  assert.equal(e.ctx.planningDate_('3 Februari 2026', tz, '').toISOString(), '2026-02-02T17:00:00.000Z');
  assert.throws(() => e.ctx.planningDate_('27 Maret', tz, ''), /explicit/);
  assert.throws(() => e.ctx.planningDate_('31 Maret 26', tz, ''), /explicit/);
  assert.equal(e.ctx.planningDate_('31 Maret 26', tz, 2026).toISOString(), '2026-03-30T17:00:00.000Z');
  assert.throws(() => e.ctx.planningDate_('31 Februari 2026', tz, 2026), /INVALID_DATE/);
});

test('narrative parser rejects bad headers, duplicate keys, unexpected rows and invalid baseline', () => {
  for (const mutate of [v => v[3][5] = 'CHANGED', v => v[7][5] = 'UNKNOWN', v => v[8][8] = 45999, v => append(v, 'PLAN-A'), v => v[10][4] = 'unexpected']) {
    const e = environment(), v = fixture(); append(v, 'PLAN-A'); mutate(v);
    assert.throws(() => e.ctx.parseSro2026_(v, config(e), false), /PLANNING_STRUCTURE_CHANGED|BASELINE_MISMATCH|DUPLICATE_RECORD/);
  }
});

function integration() {
  const e = environment(); e.ctx.setupSroPilot(); e.ctx.saveMasterRecord('Project', {Project_Name: 'Synthetic store'});
  const sheet = new e.Sheet('SRO-2026'); sheet.data = fixture(); append(sheet.data, 'PLAN-A', 1, 1); append(sheet.data, 'PLAN-B', 0, 0);
  e.source = sheet; e.sources.source = {getId: () => 'source', getSpreadsheetTimeZone: () => 'Etc/UTC', getSheetByName: () => sheet};
  const settings = {PLANNING_PROFILE: 'SRO_2026', PLANNING_SPREADSHEET_ID: 'source', PLANNING_SHEET_NAME: 'SRO-2026', PLANNING_PROJECT_MAP_JSON: JSON.stringify({'Synthetic store': 'PRJ-0001'}), PLANNING_DATE_YEAR: 2026, PLANNING_INITIAL_ACTUAL: 'SOURCE_ONCE'};
  Object.entries(settings).forEach(([k, v]) => e.sheets['90_SETTINGS'].data.find(r => r[0] === k)[1] = v);
  return e;
}

test('source actual migrates once; later inbound sync preserves SRO actual and does not invent verification', () => {
  const e = integration(); e.ctx.planningSyncJob();
  let r = e.ctx.sroTable_(e.ss)[0]; assert.equal(r.Actual_Progress, 1); assert.equal(r.Lifecycle_Status, 'WAITING VERIFICATION');
  assert.equal(r.Closed_Date, ''); assert.equal(r.Last_Progress_Update, '');
  e.source.data[8][9] = .25; e.ctx.planningSyncJob(); assert.equal(e.ctx.sroTable_(e.ss)[0].Actual_Progress, 1);
  e.source.data[13][9] = 1; e.ctx.planningSyncJob(); assert.equal(e.ctx.sroTable_(e.ss).length, 2);
  assert.equal(e.ctx.sroTable_(e.ss)[1].Actual_Progress, 0);
});

test('Viewer preview has no source writes and formula-based baseline approval preserves Finish formula', () => {
  const e = integration(); const preview = e.ctx.previewPlanningSource(); assert.equal(preview.total, 2); assert.equal(e.state.batches.length, 0);
  e.ctx.planningSyncJob(); e.sheets['90_SETTINGS'].data.find(r => r[0] === 'PLANNING_PUSHBACK_ENABLED')[1] = true;
  // Parser serials produce typed SRO dates; the source write adapter sees typed dates as real Apps Script does.
  e.source.data[8][7] = e.ctx.localDateFromDay_(46000 - 25569, 'Etc/UTC');
  e.source.data[8][8] = e.ctx.localDateFromDay_(46010 - 25569, 'Etc/UTC');
  e.source.formulas = {'9:9': '=G9+H9'};
  const id = e.ctx.sroTable_(e.ss)[0].SRO_ID;
  const proposed = e.ctx.localDateFromDay_(46015 - 25569, 'Etc/UTC');
  e.ctx.updateSroRecord(id, {Proposed_Finish: proposed, Revision_Reason: 'Test revision'});
  e.ctx.updateSroRecord(id, {Revision_Status: 'APPROVED'});
  const writes = e.state.batches.at(-1).data;
  assert.equal(writes.length, 1); assert.equal(writes[0].range, "'SRO-2026'!G9");
  assert.equal(e.source.formulas['9:9'], '=G9+H9');
  assert.equal(+e.ctx.sroTable_(e.ss)[0].Current_Finish, +proposed);
});
