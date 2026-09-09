/** Caller must hold the document lock through ID allocation AND record write. */
function nextId_(ss, kind, now) {
  var specs = {
    Project: ['PRJ', '10_PROJECT_MASTER', false], Vendor: ['VEN', '11_VENDOR_MASTER', false],
    User: ['USR', '12_USER_MASTER', false], SRO: ['SRO', '01_SRO', true],
    Finding: ['HF', '02_HANDOVER_FINDING', true], SI: ['SI', '03_SPECIAL_INSTRUCTION', true],
    Outstanding: ['OUT', '04_OUTSTANDING', true]
  };
  var spec = specs[kind];
  if (!spec) throw new Error('INVALID_ID_KIND: ' + kind);
  var prefix = spec[0] + '-' + (spec[2] ? Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), 'yyyy') + '-' : '');
  var key = 'ID_COUNTER:' + prefix;
  var properties = PropertiesService.getDocumentProperties();
  var max = Number(properties.getProperty(key) || 0);
  if (!Number.isSafeInteger(max) || max < 0) throw new Error('INVALID_ID_COUNTER: ' + key);
  var seen = {};
  rows_(ss.getSheetByName(spec[1])).forEach(function (r) {
    var id = String(r[0]);
    if (!id) return;
    if (seen[id]) throw new Error('DUPLICATE_RECORD: ' + id);
    seen[id] = true;
    if (id.indexOf(prefix) === 0) {
      var suffix = id.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) throw new Error('INVALID_ID: ' + id);
      max = Math.max(max, Number(suffix));
    }
  });
  if (!Number.isSafeInteger(max + 1)) throw new Error('ID_COUNTER_EXHAUSTED');
  properties.setProperty(key, String(max + 1));
  return prefix + String(max + 1).padStart(4, '0');
}
