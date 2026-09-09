const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Range {
  constructor(sheet, row, col, height = 1, width = 1) { Object.assign(this, {sheet, row, col, height, width}); }
  getValues() { return Array.from({length: this.height}, (_, i) => Array.from({length: this.width}, (_, j) => this.sheet.data[this.row + i - 1]?.[this.col + j - 1] ?? '')); }
  getSheet() { return this.sheet; }
  getRow() { return this.row; }
  getColumn() { return this.col; }
  getNumRows() { return this.height; }
  getNumColumns() { return this.width; }
  getFormula() { return this.sheet.formulas?.[`${this.row}:${this.col}`] || ''; }
  protect() { const p = new Protection(this.sheet); p.type = 'RANGE'; this.sheet.protections.push(p); return p; }
  setValues(rows) {
    if (rows.length !== this.height || rows.some(r => r.length !== this.width)) throw Error('Range shape mismatch');
    if (this.row + this.height - 1 > this.sheet.maxRows || this.col + this.width - 1 > this.sheet.maxCols) throw Error('Range exceeds grid');
    rows.forEach((r, i) => r.forEach((v, j) => { (this.sheet.data[this.row + i - 1] ||= [])[this.col + j - 1] = v; }));
    return this;
  }
  setDataValidation(rule) { this.sheet.rules[this.col] = rule; return this; }
}
for (const name of ['setBackground', 'setFontColor', 'setFontWeight', 'setWrap', 'setNumberFormat']) Range.prototype[name] = function () { return this; };
class Protection {
  constructor(sheet) { this.sheet = sheet; this.editors = []; this.warning = true; this.type = 'SHEET'; }
  setRange(range) { this.range = range; return this; }
  setDescription(d) { this.description = d; return this; }
  getDescription() { return this.description; }
  setWarningOnly(v) { this.warning = v; return this; }
  addEditors(es) { this.editors = [...new Set([...this.editors, ...es])]; return this; }
  getEditors() { return this.editors.map(e => ({getEmail: () => e})); }
  removeEditors(es) { if (es.some(e => typeof e !== 'string')) throw Error('Expected email strings'); this.editors = this.editors.filter(e => !es.includes(e)); }
  canDomainEdit() { return false; }
  setUnprotectedRanges(rs) { this.unprotected = rs; }
  remove() { this.sheet.protections = this.sheet.protections.filter(p => p !== this); }
}
class Sheet {
  constructor(name) { Object.assign(this, {name, data: [], maxRows: 1000, maxCols: 26, protections: [], rules: {}, hiddenColumns: []}); }
  getLastRow() { return this.data.length; }
  getName() { return this.name; }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getLastColumn() { return Math.max(0, ...this.data.map(r => r.length)); }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  getRange(...args) { return new Range(this, ...args); }
  insertRowsAfter(_, n) { this.maxRows += n; }
  insertColumnsAfter(_, n) { this.maxCols += n; }
  getProtections(type) { return this.protections.filter(p => p.type === type); }
  protect() { const p = new Protection(this); this.protections.push(p); return p; }
  hideColumns(n) { this.hiddenColumns.push(n); }
  hideSheet() { this.hidden = true; }
}
for (const name of ['setFrozenRows', 'setColumnWidths', 'setRowHeight', 'setHiddenGridlines']) Sheet.prototype[name] = function () { return this; };
function environment() {
  const sheets = {}, named = {}, properties = {}, sources = {}, triggers = [];
  const ss = {getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)), setNamedRange: (n, r) => named[n] = r,
    setActiveSheet: s => ss.active = s.name, getId: () => 'test-workbook', getSpreadsheetTimeZone: () => 'Etc/UTC', toast: () => {}};
  const state = {actor: 'admin@example.com', lockHeld: false, releases: 0, failPush: false, batches: []};
  const ctx = vm.createContext({Date, console, SpreadsheetApp: {getActiveSpreadsheet: () => ss, openById: id => { if (!sources[id]) throw Error('Source permission denied'); return sources[id]; }, flush() {}, ProtectionType: {SHEET: 'SHEET', RANGE: 'RANGE'}, newDataValidation() {
    const rule = {};
    const builder = {setAllowInvalid(v) { rule.allowInvalid = v; return this; }, build: () => rule};
    for (const name of ['requireValueInRange', 'requireValueInList', 'requireCheckbox', 'requireNumberBetween', 'requireDate']) builder[name] = function (...args) { rule.type = name; rule.args = args; return this; };
    return builder;
  }}, Session: {getActiveUser: () => ({getEmail: () => state.actor}), getEffectiveUser: () => ({getEmail: () => state.actor})},
  LockService: {getDocumentLock: () => ({waitLock() { if (state.lockHeld) throw Error('Already locked'); state.lockHeld = true; }, releaseLock() { state.lockHeld = false; state.releases++; }})},
  PropertiesService: {getDocumentProperties: () => ({getProperty: k => properties[k] ?? null, setProperty(k, v) { if (!state.lockHeld) throw Error('Unlocked ID allocation'); properties[k] = v; }})},
  ScriptApp: {getProjectTriggers: () => triggers.slice(), deleteTrigger(t) { triggers.splice(triggers.indexOf(t), 1); }, newTrigger(handler) {
    const trigger = {getHandlerFunction: () => handler};
    const b = {forSpreadsheet() { return b; }, onEdit() { trigger.kind = 'edit'; return b; }, timeBased() { trigger.kind = 'time'; return b; }, everyMinutes(n) { trigger.minutes = n; return b; }, create() { triggers.push(trigger); return trigger; }}; return b;
  }},
  Sheets: {Spreadsheets: {Values: {batchUpdate(body, id) {
    if (state.failPush) throw Error('Simulated source write failure');
    state.batches.push(body);
    for (const update of body.data) {
      const m = update.range.match(/^'(.+)'!([A-Z]+)(\d+)$/), name = m[1].replace(/''/g, "'");
      const col = [...m[2]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      const range = sources[id].getSheetByName(name).getRange(+m[3], col);
      const old = range.getValues()[0][0], value = update.values[0][0];
      range.setValues([[old instanceof Date && typeof value === 'number' ? new Date((value - 25569) * 86400000) : value]]);
    }
  }}}},
  Utilities: {getUuid: () => require('node:crypto').randomUUID(), formatDate(d, tz, pattern) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(d);
    const p = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return pattern === 'yyyy' ? p.year : `${p.year}-${p.month}-${p.day}`;
  }, parseDate(text, tz) {
    let date = new Date(text + 'T00:00:00Z');
    const label = new Intl.DateTimeFormat('en-US', {timeZone: tz, timeZoneName: 'longOffset'}).formatToParts(date).find(p => p.type === 'timeZoneName').value;
    const match = label.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (match) date = new Date(+date - (match[1] === '+' ? 1 : -1) * (+match[2] * 60 + +match[3]) * 60000);
    return date;
  }}});
  for (const file of fs.readdirSync(path.join(__dirname, '../apps-script')).filter(f => f.endsWith('.gs'))) vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script', file), 'utf8'), ctx, {filename: file});
  return {ctx, ss, sheets, named, properties, state, sources, triggers, Sheet};
}
module.exports = {environment};
