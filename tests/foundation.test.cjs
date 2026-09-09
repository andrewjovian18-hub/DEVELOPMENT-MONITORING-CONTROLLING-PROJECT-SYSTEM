const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {environment} = require('./fake-apps-script.cjs');
const start = () => { const e = environment(); e.ctx.setupFoundation(); return e; };

test('creates the 19 documented sheets and exact dictionary columns', () => {
  const {ctx, sheets} = start();
  const spec = fs.readFileSync('docs/TECHNICAL_SPEC.md', 'utf8');
  const expected = spec.match(/```text\n([\s\S]*?)```/)[1].trim().split('\n');
  assert.deepEqual(Object.keys(sheets).sort(), expected.sort());
  const dict = fs.readFileSync('docs/DATA_DICTIONARY.md', 'utf8');
  for (const m of dict.matchAll(/## `([^`]+)`\n([\s\S]*?)(?=\n## |$)/g)) {
    if (m[1] === '90_SETTINGS') continue;
    const columns = m[1] === '01_SRO' ? m[2].trim().split('\n').map(s => s.split(' ')[1]) : m[2].split('\n')[0].replace(/\.$/, '').split(', ');
    assert.deepEqual(Array.from(ctx.PMCS.schemas[m[1]]), columns);
  }
});
test('setup rerun preserves records/settings and does not duplicate protection or seeds', () => {
  const {ctx, sheets, named} = start();
  const id = ctx.saveMasterRecord('Project', {Project_Name: 'Example'});
  const count = sheets['13_STATUS_MASTER'].getLastRow();
  sheets['01_SRO'].protections[0].editors.push('former-admin@example.com');
  sheets['90_SETTINGS'].data.find(r => r[0] === 'DELAY_THRESHOLD_PP')[1] = 12;
  ctx.setupFoundation();
  assert.equal(sheets['10_PROJECT_MASTER'].data[1][0], id);
  assert.equal(ctx.setting_({getSheetByName: n => sheets[n]}, 'DELAY_THRESHOLD_PP'), 12);
  assert.equal(sheets['13_STATUS_MASTER'].getLastRow(), count);
  assert.equal(Object.keys(named).length, 12);
  for (const sheet of Object.values(sheets)) { assert.equal(sheet.protections.length, 1); assert.equal(sheet.protections[0].warning, false); }
  assert.deepEqual(sheets['01_SRO'].protections[0].editors, ['admin@example.com']);
});
test('schema conflict fails before creating other sheets', () => {
  const {ctx, ss, sheets} = environment();
  ss.insertSheet('01_SRO').getRange(1, 1).setValues([['Wrong']]);
  assert.throws(() => ctx.setupFoundation(), /SCHEMA_MISMATCH/);
  assert.equal(Object.keys(sheets).length, 1);
});
test('IDs persist after sort/deletion, recover counter from imports, and roll years independently', () => {
  const {ctx, sheets, properties, ss} = start();
  assert.equal(ctx.saveMasterRecord('Project', {Project_Name: 'A'}), 'PRJ-0001');
  assert.equal(ctx.saveMasterRecord('Project', {Project_Name: 'B'}), 'PRJ-0002');
  [sheets['10_PROJECT_MASTER'].data[1], sheets['10_PROJECT_MASTER'].data[2]] = [sheets['10_PROJECT_MASTER'].data[2], sheets['10_PROJECT_MASTER'].data[1]];
  ctx.saveMasterRecord('Project', {Location: 'New'}, 'PRJ-0001');
  assert.equal(sheets['10_PROJECT_MASTER'].data[2][2], 'New');
  sheets['10_PROJECT_MASTER'].data.pop();
  assert.equal(ctx.saveMasterRecord('Project', {Project_Name: 'C'}), 'PRJ-0003');
  properties['ID_COUNTER:PRJ-'] = '0';
  assert.equal(ctx.saveMasterRecord('Project', {Project_Name: 'D'}), 'PRJ-0004');
  const allocate = date => ctx.withFoundationLock_(() => ctx.nextId_(ss, 'SRO', new Date(date)));
  assert.equal(allocate('2026-01-01'), 'SRO-2026-0001');
  assert.equal(allocate('2026-01-01'), 'SRO-2026-0002');
  assert.equal(allocate('2027-01-01'), 'SRO-2027-0001');
});
test('timestamps preserve Created_At, audit identifies immutable key, bad dates fail (AT38)', () => {
  const {ctx, sheets, state} = start();
  const id = ctx.saveMasterRecord('Project', {Project_Name: 'A', Project_Start: new Date('2026-01-01')});
  const created = sheets['10_PROJECT_MASTER'].data[1][11];
  ctx.saveMasterRecord('Project', {Location: 'B'}, id);
  assert.equal(sheets['10_PROJECT_MASTER'].data[1][11], created);
  assert.throws(() => ctx.saveMasterRecord('Project', {Project_Start: 'yesterday'}, id), /INVALID_DATE/);
  assert.throws(() => ctx.saveMasterRecord('Project', {Project_ID: 'PRJ-99'}, id), /IMMUTABLE/);
  assert.ok(sheets['21_HISTORY_LOG'].data.some(r => r[3] === id && r[4] === 'Location'));
  assert.equal(state.lockHeld, false);
});
test('SI uses one vendor column, only two execution modes and independent statuses (AT21–23)', () => {
  const {ctx, sheets} = start();
  const h = Array.from(ctx.PMCS.schemas['03_SPECIAL_INSTRUCTION']);
  const rules = sheets['03_SPECIAL_INSTRUCTION'].rules;
  assert.equal(h.filter(v => v === 'Vendor_ID').length, 1);
  assert.equal(rules[h.indexOf('Vendor_ID') + 1].type, 'requireValueInRange');
  assert.deepEqual(Array.from(rules[h.indexOf('Execution_Mode') + 1].args[0]), ['AFTER PO', 'PARALLEL']);
  assert.notDeepEqual(rules[h.indexOf('Commercial_Status') + 1].args, rules[h.indexOf('Execution_Status') + 1].args);
  assert.equal(rules[h.indexOf('Execution_Mode') + 1].allowInvalid, false);
});
test('non-admin writes rejected; bootstrap email required; last self-admin protected', () => {
  const e = start();
  assert.throws(() => e.ctx.saveMasterRecord('User', {Active: false}, 'USR-0001'), /PERMISSION_DENIED/);
  e.state.actor = 'site@example.com';
  assert.throws(() => e.ctx.saveMasterRecord('Project', {Project_Name: 'A'}), /PERMISSION_DENIED/);
  const blank = environment(); blank.state.actor = '';
  assert.throws(() => blank.ctx.setupFoundation(), /PERMISSION_DENIED/);
});
test('duplicate IDs detected, inactive vocabulary rejected, failed writes remain auditable', () => {
  const {ctx, sheets} = start();
  const id = ctx.saveMasterRecord('Vendor', {Vendor_Name: 'A', Discipline: 'MEP'});
  assert.ok(sheets['11_VENDOR_MASTER'].data[1][7].includes(id));
  sheets['13_STATUS_MASTER'].data.find(r => r[0] === 'Discipline' && r[1] === 'MEP')[2] = false;
  assert.throws(() => ctx.saveMasterRecord('Vendor', {Vendor_Name: 'B', Discipline: 'MEP'}), /INVALID_STATUS/);
  sheets['11_VENDOR_MASTER'].data.push([...sheets['11_VENDOR_MASTER'].data[1]]);
  assert.throws(() => ctx.saveMasterRecord('Vendor', {Vendor_Name: 'B', Discipline: 'AC'}), /DUPLICATE_RECORD/);
  sheets['10_PROJECT_MASTER'].getRange = () => ({setValues() { throw Error('Simulated write outage'); }});
  assert.throws(() => ctx.saveMasterRecord('Project', {Project_Name: 'B'}), /Simulated write outage/);
  assert.ok(sheets['21_HISTORY_LOG'].data.some(r => r[4] === 'WRITE_ERROR'));
});
