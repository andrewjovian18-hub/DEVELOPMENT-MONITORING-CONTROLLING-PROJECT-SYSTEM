function sroTable_(ss) {
  var sheet = ss.getSheetByName('01_SRO'), headers = PMCS.schemas['01_SRO'];
  if (JSON.stringify(sheet.getRange(1, 1, 1, headers.length).getValues()[0]) !== JSON.stringify(headers)) throw new Error('SCHEMA_MISMATCH: 01_SRO');
  var records = [], ids = Object.create(null), keys = Object.create(null);
  rows_(sheet).forEach(function (row) {
    if (row.every(function (v) { return v === ''; })) return;
    var record = {}; headers.forEach(function (h, i) { record[h] = row[i]; });
    if (!record.SRO_ID || !record.Planning_Sync_ID) throw new Error('SYNC_ID_NOT_FOUND: SRO row requires immutable IDs');
    if (ids[record.SRO_ID] || keys[record.Planning_Sync_ID]) throw new Error('DUPLICATE_RECORD: SRO/Planning ID');
    ids[record.SRO_ID] = true; keys[record.Planning_Sync_ID] = true; records.push(record);
  });
  return records;
}

function sroSnapshots_(ss) {
  var state = Object.create(null);
  rows_(ss.getSheetByName('99_SYSTEM')).forEach(function (r) {
    if (String(r[0]).indexOf('SRO_STATE:') !== 0) return;
    var id = String(r[0]).slice(10);
    if (state[id]) throw new Error('DUPLICATE_RECORD: snapshot ' + id);
    var record = JSON.parse(r[1]);
    PMCS.schemas['01_SRO'].forEach(function (field) { if (isDateField_(field) && record[field] !== '') record[field] = new Date(record[field]); });
    state[id] = record;
  });
  return state;
}

function sameSroValue_(a, b) { return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b; }

function assertSroClean_(records, snapshots) {
  if (records.length !== Object.keys(snapshots).length || records.some(function (record) {
    var saved = snapshots[record.SRO_ID];
    return !saved || PMCS.schemas['01_SRO'].some(function (h) { return !sameSroValue_(record[h], saved[h]); });
  })) throw new Error('PENDING_EDIT: SRO differs from committed state; wait for edit handler or reconcile audit before syncing');
}

function writeSroRecords_(ss, before, after, actor, source, now) {
  var headers = PMCS.schemas['01_SRO'], old = Object.create(null), changes = [];
  before.forEach(function (r) { old[r.SRO_ID] = r; });
  after.forEach(function (r) { headers.forEach(function (h) {
    var previous = old[r.SRO_ID] ? old[r.SRO_ID][h] : '';
    if (!sameSroValue_(previous, r[h])) changes.push([now, actor, 'SRO', r.SRO_ID, h, previous, r[h], source]);
  }); });
  if (!changes.length) return;
  auditRows_(ss, changes.map(function (r) { var entry = r.slice(); entry[4] = 'WRITE_INTENT:' + r[4]; return entry; }));
  var sheet = ss.getSheetByName('01_SRO');
  ensureRows_(sheet, after.length + 1);
  // Managed SRO table contains values only. Never import source formulas as executable text.
  sheet.getRange(2, 1, after.length, headers.length).setValues(after.map(function (r) { return headers.map(function (h) {
    var v = r[h]; return typeof v === 'string' && v.charAt(0) === '=' ? "'" + v : v;
  }); }));
  auditRows_(ss, changes);
  var system = ss.getSheetByName('99_SYSTEM');
  var state = rows_(system).filter(function (r) { return String(r[0]).indexOf('SRO_STATE:') !== 0; });
  after.forEach(function (r) { state.push(['SRO_STATE:' + r.SRO_ID, JSON.stringify(r)]); });
  ensureRows_(system, state.length + 1);
  if (state.length) system.getRange(2, 1, state.length, 2).setValues(state);
  // No deletion APIs: a snapshot mismatch halts the next operation after any partial failure.
}

function syncLog_(ss, entries) {
  if (!entries.length) return;
  var sheet = ss.getSheetByName('23_SYNC_LOG');
  ensureRows_(sheet, sheet.getLastRow() + entries.length);
  sheet.getRange(sheet.getLastRow() + 1, 1, entries.length, 10).setValues(entries.map(function (e) {
    return [Utilities.getUuid(), e.time || new Date(), e.id || '', e.key || '', e.direction || 'PLANNING_TO_SRO', e.field || '', e.old === undefined ? '' : e.old, e.value === undefined ? '' : e.value, e.error ? 'ERROR' : 'SUCCESS', e.error || ''].map(function (v) { return typeof v === 'string' && v.charAt(0) === '=' ? "'" + v : v; });
  }));
}

function sroError_(ss, error, id, key, direction) {
  syncLog_(ss, [{id: id, key: key, direction: direction, error: String(error)}]);
}
