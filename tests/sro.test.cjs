const test = require('node:test');
const assert = require('node:assert/strict');
const {environment} = require('./fake-apps-script.cjs');
const headers = ['Planning_Sync_ID', 'Project_ID', 'Request_Item', 'Store_Location', 'Issuer', 'Request_Date', 'RO_Date', 'Stage', 'Progress', 'Duration', 'Start', 'Finish'];
const d = day => new Date(day + 'T00:00:00Z');
function block(key, progress = 1, start = d('2026-09-01'), finish = d('2026-09-11'), duration = 10) {
  return [
    [key, 'PRJ-0001', 'Synthetic request', 'Synthetic site', 'Test', '', '', 'DESIGN', 1, '', '', ''],
    ['', '', '', '', '', '', '', 'TENDER', progress, '', '', ''],
    ['', '', '', '', '', '', '', 'EXECUTION', 0, duration, start, finish]
  ];
}
function pilot(data = block('PLAN-A')) {
  const e = environment(); e.ctx.setupSroPilot();
  e.ctx.saveMasterRecord('Project', {Project_Name: 'Synthetic project', Project_Status: 'ACTIVE'});
  const sourceSheet = new e.Sheet('Planning'); sourceSheet.data = [headers.slice(), ...data];
  e.sources.source = {getId: () => 'source', getSpreadsheetTimeZone: () => 'Etc/UTC', getSheetByName: n => n === 'Planning' ? sourceSheet : null};
  e.set = (key, value) => { e.sheets['90_SETTINGS'].data.find(r => r[0] === key)[1] = value; };
  e.set('PLANNING_SPREADSHEET_ID', 'source'); e.set('PLANNING_SHEET_NAME', 'Planning');
  e.source = sourceSheet;
  e.records = () => e.ctx.sroTable_(e.ss);
  e.errors = () => e.sheets['23_SYNC_LOG'].data.filter(r => r[8] === 'ERROR');
  return e;
}

test('AT1: new items qualify only at Tender 100%; repeated polling never duplicates', () => {
  const e = pilot(block('PLAN-A', 0.9));
  assert.equal(e.ctx.planningSyncJob().records, 0);
  e.source.data[2][8] = 1;
  e.ctx.planningSyncJob(); e.ctx.planningSyncJob();
  assert.equal(e.records().length, 1);
  e.source.data.push(...block('PLAN-B', 0.99));
  e.ctx.planningSyncJob(); assert.equal(e.records().length, 1);
  e.source.data[5][8] = 1;
  e.ctx.planningSyncJob(); assert.equal(e.records().length, 2);
  assert.notEqual(e.records()[0].SRO_ID, e.records()[1].SRO_ID);
});
test('AT2–4: incomplete baseline waits; first valid pair anchors Original; revisions only change Current', () => {
  const e = pilot(block('PLAN-A', 1, '', '', ''));
  e.ctx.planningSyncJob();
  assert.equal(e.records()[0].Lifecycle_Status, 'WAITING EXECUTION PLAN');
  assert.equal(e.records()[0].Original_Start, '');
  e.source.data[3].splice(9, 3, 10, d('2026-09-01'), d('2026-09-11'));
  e.ctx.planningSyncJob();
  assert.equal(e.records()[0].Lifecycle_Status, 'ACTIVE');
  const original = +e.records()[0].Original_Finish;
  e.source.data[3][9] = 12; e.source.data[3][11] = d('2026-09-13');
  e.ctx.planningSyncJob();
  assert.equal(+e.records()[0].Original_Finish, original);
  assert.equal(+e.records()[0].Current_Finish, +d('2026-09-13'));
  assert.ok(e.sheets['21_HISTORY_LOG'].data.some(r => r[4] === 'Current_Finish' && r[7] === 'PLANNING_SYNC'));
});
test('AT5–9: Thursday calendar progress, threshold boundary, overdue and completion priorities', () => {
  const e = pilot();
  const base = {Current_Start: d('2026-09-04'), Current_Finish: d('2026-09-14'), Execution_Duration_Source: 10, Verification_Status: 'NOT READY', Reporting_Status: 'UPDATE MISSING'};
  const calc = (actual, now = '2026-09-10', threshold = 10) => e.ctx.recalculateSro_({...base, Actual_Progress: actual}, d(now), {timezone: 'Etc/UTC', threshold});
  assert.equal(calc(.62).Planned_Progress, .6);
  assert.equal(calc(.62).Health_Status, 'ON TRACK');
  assert.equal(calc(.53).Health_Status, 'AT RISK');
  assert.equal(calc(.50).Health_Status, 'DELAYED');
  assert.equal(calc(.50, '2026-09-10', 11).Health_Status, 'AT RISK');
  assert.equal(calc(.9, '2026-09-15').Health_Status, 'DELAYED');
  assert.equal(calc(1, '2026-09-15').Lifecycle_Status, 'WAITING VERIFICATION');
  assert.equal(calc(.9, '2026-09-15').Reporting_Status, 'UPDATE MISSING');
  assert.equal(calc(0, '2026-09-01').Planned_Progress, 0);
  assert.equal(calc(0, '2026-09-20').Planned_Progress, 1);
  assert.equal(calc(.62, '2026-09-11').Reporting_Cutoff.toISOString(), '2026-09-10T00:00:00.000Z');
});
test('calendar days ignore DST; invalid/zero duration is rejected (AT38)', () => {
  const e = pilot();
  assert.equal(e.ctx.calendarDay_(new Date('2026-03-09T04:00:00Z'), 'America/New_York') - e.ctx.calendarDay_(new Date('2026-03-08T05:00:00Z'), 'America/New_York'), 1);
  assert.throws(() => e.ctx.baselineState_(d('2026-01-01'), d('2026-01-01'), 0, 'Etc/UTC'), /BASELINE_MISMATCH/);
  assert.throws(() => e.ctx.baselineState_('bad', d('2026-01-02'), 1, 'Etc/UTC'), /INVALID_DATE/);
});
test('AT10: push-back finds moved block by immutable key and touches only EXECUTION progress', () => {
  const e = pilot([...block('PLAN-A'), ...block('PLAN-B')]);
  e.set('PLANNING_PUSHBACK_ENABLED', true); e.ctx.planningSyncJob();
  const id = e.records()[0].SRO_ID;
  e.source.data = [headers.slice(), ...block('PLAN-B'), ...block('PLAN-A')];
  e.ctx.updateSroRecord(id, {Actual_Progress: .62});
  assert.equal(e.source.data[6][8], .62); assert.equal(e.source.data[3][8], 0);
  assert.equal(e.source.data[5][8], 1);
  assert.equal(e.records()[0].Sync_Status, 'SUCCESS');
  assert.equal(e.state.batches.at(-1).data.length, 1);
  assert.ok(e.sheets['23_SYNC_LOG'].data.some(r => r[4] === 'SRO_TO_PLANNING' && r[8] === 'SUCCESS'));
});
test('AT11: failed or disabled push preserves actual, flags ERROR; retry sends latest value', () => {
  const e = pilot(); e.ctx.planningSyncJob(); const id = e.records()[0].SRO_ID;
  assert.throws(() => e.ctx.updateSroRecord(id, {Actual_Progress: .53}), /PUSHBACK_DISABLED/);
  assert.equal(e.records()[0].Actual_Progress, .53); assert.equal(e.records()[0].Sync_Status, 'ERROR');
  e.set('PLANNING_PUSHBACK_ENABLED', true); e.state.failPush = true;
  assert.throws(() => e.ctx.updateSroRecord(id, {Actual_Progress: .62}), /Simulated/);
  assert.equal(e.records()[0].Actual_Progress, .62);
  e.ctx.planningSyncJob(); assert.equal(e.records()[0].Sync_Status, 'ERROR');
  e.state.failPush = false; e.ctx.retrySroPush(id);
  assert.equal(e.source.data[3][8], .62); assert.equal(e.records()[0].Sync_Status, 'SUCCESS');
  assert.ok(e.errors().length >= 2);
});
test('AT37/39: missing keys, duplicate blocks, missing/duplicate stages and changed headers fail before writes', () => {
  for (const mutate of [
    rows => rows[1][0] = '', rows => rows.push(...block('PLAN-A')),
    rows => rows[3][7] = 'BROKEN', rows => rows[0][7] = 'Renamed stage',
    rows => rows.push(['', '', '', '', '', '', '', 'EXECUTION', 0, 10, d('2026-09-01'), d('2026-09-11')])
  ]) {
    const e = pilot(); mutate(e.source.data);
    assert.throws(() => e.ctx.planningSyncJob(), /SYNC_ID_NOT_FOUND|DUPLICATE_RECORD|PLANNING_STRUCTURE_CHANGED/);
    assert.equal(e.records().length, 0); assert.ok(e.errors().length);
  }
});
test('AT38: malformed baseline logs error and creates no partial SRO', () => {
  const e = pilot([...block('PLAN-A'), ...block('PLAN-B', 1, d('2026-09-01'), d('2026-09-11'), 11)]);
  assert.throws(() => e.ctx.planningSyncJob(), /BASELINE_MISMATCH/);
  assert.equal(e.records().length, 0); assert.ok(e.errors().length);
});
test('regressed Tender is not imported; removed source is flagged without deleting actual', () => {
  const e = pilot(); e.ctx.planningSyncJob(); const finish = +e.records()[0].Current_Finish;
  e.source.data[2][8] = .5; e.source.data[3][11] = 'bad';
  e.ctx.planningSyncJob(); assert.equal(+e.records()[0].Current_Finish, finish);
  assert.equal(e.records()[0].Sync_Status, 'ERROR');
  e.source.data = [headers.slice()]; e.ctx.planningSyncJob();
  assert.equal(e.records().length, 1); assert.ok(e.errors().at(-1)[9].includes('SYNC_ID_NOT_FOUND'));
});
test('AT25–27: Site proposes; only PM/Admin approves; source/current update while Original persists', () => {
  const e = pilot(); e.set('PLANNING_PUSHBACK_ENABLED', true); e.ctx.planningSyncJob();
  const id = e.records()[0].SRO_ID;
  e.ctx.saveMasterRecord('User', {Full_Name: 'Site', Email: 'site@example.com', Role: 'Site Team'});
  e.sheets['14_USER_PROJECT_ACCESS'].data.push(['USR-0002', 'PRJ-0001', true]); e.state.actor = 'site@example.com';
  e.ctx.updateSroRecord(id, {Proposed_Finish: d('2026-09-15'), Revision_Reason: 'Synthetic revision'});
  assert.equal(e.records()[0].Revision_Status, 'PENDING');
  assert.throws(() => e.ctx.updateSroRecord(id, {Revision_Status: 'APPROVED'}), /PERMISSION_DENIED/);
  e.state.actor = 'admin@example.com'; e.ctx.updateSroRecord(id, {Revision_Status: 'APPROVED'});
  assert.equal(+e.records()[0].Original_Finish, +d('2026-09-11'));
  assert.equal(+e.records()[0].Current_Finish, +d('2026-09-15'));
  assert.equal(+e.source.data[3][11], +d('2026-09-15'));
  e.ctx.planningSyncJob(); assert.equal(+e.records()[0].Current_Finish, +d('2026-09-15'));
});
test('edit trigger restores forbidden/multi-cell input and retains committed actual after push failure', () => {
  const e = pilot(); e.ctx.planningSyncJob(); const sheet = e.sheets['01_SRO'];
  const event = (r, email = 'admin@example.com') => ({range: r, source: e.ss, user: {getEmail: () => email}});
  const original = e.records()[0].Actual_Progress;
  const progress = sheet.getRange(2, 20); progress.setValues([[.9]]);
  assert.throws(() => e.ctx.sroOnEdit(event(progress, 'unknown@example.com')), /PERMISSION_DENIED/);
  assert.equal(e.records()[0].Actual_Progress, original);
  const multi = sheet.getRange(2, 19, 1, 2); multi.setValues([[d('2026-09-01'), .5]]);
  assert.throws(() => e.ctx.sroOnEdit(event(multi)), /UNSUPPORTED_EDIT/);
  assert.equal(e.records()[0].Actual_Start, ''); assert.equal(e.records()[0].Actual_Progress, original);
  progress.setValues([[.62]]);
  assert.throws(() => e.ctx.sroOnEdit(event(progress)), /PUSHBACK_DISABLED/);
  assert.equal(e.records()[0].Actual_Progress, .62); assert.equal(e.records()[0].Sync_Status, 'ERROR');
});
test('project access, immutable IDs, formula targets and pending edits are enforced', () => {
  const e = pilot(); e.set('PLANNING_PUSHBACK_ENABLED', true); e.ctx.planningSyncJob(); const id = e.records()[0].SRO_ID;
  assert.throws(() => e.ctx.updateSroRecord(id, {SRO_ID: 'changed'}), /PERMISSION_DENIED/);
  e.ctx.saveMasterRecord('User', {Full_Name: 'PM', Email: 'pm@example.com', Role: 'Project Manager'}); e.state.actor = 'pm@example.com';
  assert.throws(() => e.ctx.updateSroRecord(id, {Remarks: 'No project grant'}), /PERMISSION_DENIED/);
  e.state.actor = 'admin@example.com'; e.source.formulas = {'4:9': '=0.1'};
  assert.throws(() => e.ctx.updateSroRecord(id, {Actual_Progress: .62}), /formula/);
  assert.equal(e.records()[0].Actual_Progress, .62);
  e.sheets['01_SRO'].data[1][19] = .7;
  assert.throws(() => e.ctx.planningSyncJob(), /PENDING_EDIT/);
  assert.equal(e.records()[0].Actual_Progress, .7);
});
test('auto-sync installs exactly one configurable poller per installer; unrelated triggers remain', () => {
  const e = pilot();
  e.ctx.enablePlanningAutoSync(); e.ctx.enablePlanningAutoSync();
  assert.equal(e.triggers.filter(t => t.getHandlerFunction() === 'planningSyncJob').length, 1);
  assert.equal(e.triggers.find(t => t.getHandlerFunction() === 'planningSyncJob').minutes, 15);
  e.set('PLANNING_SYNC_INTERVAL', 10); e.ctx.enablePlanningAutoSync();
  assert.equal(e.triggers.find(t => t.getHandlerFunction() === 'planningSyncJob').minutes, 10);
  e.ctx.disablePlanningAutoSync(); assert.equal(e.triggers.length, 1);
  assert.equal(e.triggers[0].getHandlerFunction(), 'sroOnEdit');
});

test('Design-only requests do not block completed Tender requests; pilot setup/role refresh retains inputs', () => {
  const e = pilot([...block('PLAN-EARLY').slice(0, 1), ...block('PLAN-READY')]);
  e.ctx.planningSyncJob(); assert.equal(e.records().length, 1);
  assert.equal(e.records()[0].Planning_Sync_ID, 'PLAN-READY');
  e.ctx.setupSroPilot();
  assert.equal(e.triggers.filter(t => t.getHandlerFunction() === 'sroOnEdit').length, 1);
  e.ctx.saveMasterRecord('User', {Full_Name: 'Site', Email: 'site@example.com', Role: 'Site Team'});
  const protections = e.sheets['01_SRO'].protections;
  assert.equal(protections.find(p => p.type === 'SHEET').unprotected.length, 12);
  assert.ok(protections.find(p => p.description === 'PMCS:sro-input:Actual_Progress').editors.includes('site@example.com'));
  assert.ok(!protections.find(p => p.description === 'PMCS:sro-input:Revision_Status').editors.includes('site@example.com'));
});

test('unchanged source polling is idempotent for timestamps, histories and IDs', () => {
  const e = pilot(); e.ctx.planningSyncJob();
  const time = +e.records()[0].Updated_At, rows = e.sheets['21_HISTORY_LOG'].getLastRow();
  assert.equal(e.ctx.planningSyncJob().changes, 0);
  assert.equal(+e.records()[0].Updated_At, time);
  assert.equal(e.sheets['21_HISTORY_LOG'].getLastRow(), rows);
});

test('optional Editor ID provisioning persists UUID once; Viewer mode never writes source IDs', () => {
  const e = pilot(block('', .5));
  assert.throws(() => e.ctx.planningSyncJob(), /SYNC_ID_NOT_FOUND/);
  assert.equal(e.state.batches.length, 0);
  e.set('PLANNING_PROVISION_IDS', true); e.ctx.planningSyncJob();
  const key = e.source.data[1][0]; assert.match(key, /^PLAN-[a-f0-9-]+$/);
  assert.equal(e.records().length, 0);
  e.source.data[2][8] = 1; e.ctx.planningSyncJob(); e.ctx.planningSyncJob();
  assert.equal(e.records()[0].Planning_Sync_ID, key);
  assert.equal(e.state.batches.length, 1);
});
