/** Calendar arithmetic uses local date labels, avoiding 23/25-hour daylight-saving days. */
function calendarDay_(date, timezone) {
  assertDate_(date, 'calendar date');
  if (date === '') throw new Error('INVALID_DATE: missing calendar date');
  return Date.parse(Utilities.formatDate(date, timezone, 'yyyy-MM-dd') + 'T00:00:00Z') / 86400000;
}

function localDateFromDay_(day, timezone) {
  return Utilities.parseDate(new Date(day * 86400000).toISOString().slice(0, 10), timezone, 'yyyy-MM-dd');
}

function validateProgress_(value, allowBlank) {
  if (value === '' && allowBlank) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error('INVALID_PROGRESS: expected numeric 0..1');
}

function baselineState_(start, finish, duration, timezone) {
  if (start !== '') assertDate_(start, 'Start');
  if (finish !== '') assertDate_(finish, 'Finish');
  if (duration !== '' && (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0)) throw new Error('BASELINE_MISMATCH: duration must be positive');
  if (start === '' || finish === '' || duration === '') return 'INCOMPLETE';
  var days = calendarDay_(finish, timezone) - calendarDay_(start, timezone);
  if (days <= 0 || days !== duration) throw new Error('BASELINE_MISMATCH: duration must equal Finish - Start (no +1)');
  return 'VALID';
}

function progressConfig_(ss) {
  var threshold = Number(setting_(ss, 'DELAY_THRESHOLD_PP'));
  if (!(threshold > 0 && threshold <= 100)) throw new Error('INVALID_SETTING: DELAY_THRESHOLD_PP');
  if (setting_(ss, 'WEEKLY_CUTOFF_DAY') !== 'THURSDAY') throw new Error('INVALID_SETTING: cut-off must remain THURSDAY');
  return {timezone: ss.getSpreadsheetTimeZone(), threshold: threshold};
}

function recalculateSro_(record, now, cfg) {
  validateProgress_(record.Actual_Progress, true);
  var today = calendarDay_(now, cfg.timezone);
  var cutoff = today - ((new Date(today * 86400000).getUTCDay() + 3) % 7);
  record.Reporting_Cutoff = localDateFromDay_(cutoff, cfg.timezone);
  var baseline = baselineState_(record.Current_Start, record.Current_Finish, record.Execution_Duration_Source, cfg.timezone);
  record.Baseline_Validation = baseline;
  if (baseline !== 'VALID') {
    record.Lifecycle_Status = 'WAITING EXECUTION PLAN'; record.Health_Status = 'N/A';
    ['Duration_Days', 'Planned_Progress', 'Variance_pp', 'Remaining_Days', 'Delay_Days'].forEach(function (f) { record[f] = ''; });
    return record;
  }
  var start = calendarDay_(record.Current_Start, cfg.timezone), finish = calendarDay_(record.Current_Finish, cfg.timezone);
  record.Duration_Days = finish - start;
  record.Planned_Progress = Math.max(0, Math.min(1, (Math.min(cutoff, finish) - start) / record.Duration_Days));
  // Blank actual is not a fabricated zero update; initial records explicitly start at zero.
  var actual = record.Actual_Progress;
  record.Variance_pp = actual === '' ? '' : Math.round((actual - record.Planned_Progress) * 1e10) / 1e8;
  record.Remaining_Days = finish - today;
  record.Delay_Days = actual === 1 ? 0 : Math.max(0, today - finish);
  record.Lifecycle_Status = record.Verification_Status === 'VERIFIED' && actual === 1 ? 'CLOSED' : actual === 1 ? 'WAITING VERIFICATION' : 'ACTIVE';
  record.Health_Status = actual === '' || actual === 1 ? 'N/A' : today > finish ? 'DELAYED' : actual >= record.Planned_Progress ? 'ON TRACK' : -record.Variance_pp >= cfg.threshold ? 'DELAYED' : 'AT RISK';
  // Reporting_Status is independent; missing/stale detection is Sprint 7, not schedule health.
  return record;
}
