/** Admin API: immutable IDs, typed values, timestamps and audit. No workflow creation. */
function saveMasterRecord(kind, values, id) {
  return withFoundationLock_(function () {
    var ss = workbook_(), actor = requireAdmin_(ss), now = new Date();
    var names = {Project: '10_PROJECT_MASTER', Vendor: '11_VENDOR_MASTER', User: '12_USER_MASTER'};
    if (!names[kind]) throw new Error('INVALID_MASTER: ' + kind);
    var name = names[kind], headers = PMCS.schemas[name], sheet = ss.getSheetByName(name), data = rows_(sheet);
    var key = headers[0];
    var matches = data.map(function (r, i) { return r[0] === id ? i : -1; }).filter(function (i) { return i >= 0; });
    if (id && matches.length !== 1) throw new Error('RECORD_NOT_FOUND_OR_DUPLICATE: ' + id);
    var index = id ? matches[0] : data.length;
    var old = id ? data[index] : headers.map(function () { return ''; });
    var record = {};
    headers.forEach(function (h, i) { record[h] = old[i]; });
    Object.keys(values).forEach(function (h) {
      if (headers.indexOf(h) < 0 || h === key || /^(Created|Updated)_/.test(h) || h === 'Vendor_Display') throw new Error('IMMUTABLE_OR_UNKNOWN_FIELD: ' + h);
      var value = values[h];
      if (isDateField_(h)) assertDate_(value, h);
      else if (h === 'Active' && typeof value !== 'boolean') throw new Error('INVALID_BOOLEAN: Active');
      else if (typeof value !== 'string' && typeof value !== 'boolean') throw new Error('INVALID_VALUE: ' + h);
      if (typeof value === 'string' && /^[=+@]/.test(value)) throw new Error('INVALID_VALUE: formula-like input in ' + h);
      record[h] = value;
    });
    if (!id && record.Active === '') record.Active = true;
    var required = {Project: ['Project_Name'], Vendor: ['Vendor_Name', 'Discipline'], User: ['Full_Name', 'Email', 'Role']}[kind];
    required.forEach(function (h) { if (!String(record[h]).trim()) throw new Error('REQUIRED_FIELD: ' + h); });
    var statuses = rows_(ss.getSheetByName('13_STATUS_MASTER'));
    ['Discipline', 'Role', 'Project_Status'].forEach(function (h) {
      if (record[h] && !statuses.some(function (r) { return r[0] === h && r[1] === record[h] && r[2] === true; })) throw new Error('INVALID_STATUS: ' + h);
    });
    headers.filter(function (h) { return /Email$/.test(h); }).forEach(function (h) {
      if (record[h] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record[h])) throw new Error('INVALID_EMAIL: ' + h);
    });
    if (kind === 'Project' && record.Project_Start && record.Project_Finish && record.Project_Finish < record.Project_Start) throw new Error('INVALID_DATE: finish precedes start');
    if (kind === 'User') {
      if (data.some(function (r, i) { return i !== index && String(r[2]).toLowerCase() === record.Email.toLowerCase(); })) throw new Error('DUPLICATE_RECORD: Email');
      if (id && String(old[2]).toLowerCase() === actor && (record.Role !== 'Admin' || record.Active !== true || record.Email.toLowerCase() !== actor)) throw new Error('PERMISSION_DENIED: cannot remove own Admin access');
    }
    record[key] = id || nextId_(ss, kind, now);
    if (kind === 'Vendor') record.Vendor_Display = record.Discipline + ' | ' + record.Vendor_Name + ' | ' + record[key];
    stampRecord_(record, !id, actor, now);
    var row = headers.map(function (h) { return record[h]; });
    var changes = [];
    headers.forEach(function (h, i) {
      if (String(old[i]) !== String(row[i])) changes.push([now, actor, kind, record[key], h, old[i], row[i], 'USER']);
    });
    // Audit intent first; a failed write is explicitly logged and rethrown.
    auditRows_(ss, [[now, actor, kind, record[key], 'WRITE_INTENT', '', JSON.stringify(record), 'SYSTEM']]);
    try {
      ensureRows_(sheet, index + 2);
      sheet.getRange(index + 2, 1, 1, headers.length).setValues([row]);
      auditRows_(ss, changes);
      if (kind === 'User') applyFoundationProtections_(ss);
      refreshFoundationValidation_(ss);
    } catch (error) {
      auditRows_(ss, [[new Date(), actor, kind, record[key], 'WRITE_ERROR', '', String(error), 'SYSTEM']]);
      throw error;
    }
    return record[key];
  });
}
