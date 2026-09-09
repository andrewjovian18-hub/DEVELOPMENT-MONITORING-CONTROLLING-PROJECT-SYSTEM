const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Range {
  constructor(sheet, row, col, height = 1, width = 1) { Object.assign(this, {sheet, row, col, height, width}); }
  getValues() { return Array.from({length: this.height}, (_, i) => Array.from({length: this.width}, (_, j) => this.sheet.data[this.row + i - 1]?.[this.col + j - 1] ?? '')); }
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
  constructor(sheet) { this.sheet = sheet; this.editors = []; this.warning = true; }
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
  getLastColumn() { return Math.max(0, ...this.data.map(r => r.length)); }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  getRange(...args) { return new Range(this, ...args); }
  insertRowsAfter(_, n) { this.maxRows += n; }
  insertColumnsAfter(_, n) { this.maxCols += n; }
  getProtections() { return this.protections; }
  protect() { const p = new Protection(this); this.protections.push(p); return p; }
  hideColumns(n) { this.hiddenColumns.push(n); }
  hideSheet() { this.hidden = true; }
}
for (const name of ['setFrozenRows', 'setColumnWidths', 'setRowHeight', 'setHiddenGridlines']) Sheet.prototype[name] = function () { return this; };
function environment() {
  const sheets = {}, named = {}, properties = {};
  const ss = {getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)), setNamedRange: (n, r) => named[n] = r,
    setActiveSheet: s => ss.active = s.name, getId: () => 'test-workbook', getSpreadsheetTimeZone: () => 'Etc/UTC'};
  const state = {actor: 'admin@example.com', lockHeld: false, releases: 0};
  const ctx = vm.createContext({Date, console, SpreadsheetApp: {getActiveSpreadsheet: () => ss, ProtectionType: {SHEET: 'SHEET'}, newDataValidation() {
    const rule = {};
    const builder = {setAllowInvalid(v) { rule.allowInvalid = v; return this; }, build: () => rule};
    for (const name of ['requireValueInRange', 'requireValueInList', 'requireCheckbox', 'requireNumberBetween', 'requireDate']) builder[name] = function (...args) { rule.type = name; rule.args = args; return this; };
    return builder;
  }}, Session: {getActiveUser: () => ({getEmail: () => state.actor})},
  LockService: {getDocumentLock: () => ({waitLock() { if (state.lockHeld) throw Error('Already locked'); state.lockHeld = true; }, releaseLock() { state.lockHeld = false; state.releases++; }})},
  PropertiesService: {getDocumentProperties: () => ({getProperty: k => properties[k] ?? null, setProperty(k, v) { if (!state.lockHeld) throw Error('Unlocked ID allocation'); properties[k] = v; }})},
  Utilities: {formatDate: d => String(d.getUTCFullYear())}});
  for (const file of fs.readdirSync(path.join(__dirname, '../apps-script')).filter(f => f.endsWith('.gs'))) vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script', file), 'utf8'), ctx, {filename: file});
  return {ctx, ss, sheets, named, properties, state};
}
module.exports = {environment};
