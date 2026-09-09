/** Initial values only. Subsequent setup preserves administrator edits. */
function foundationSettings_() {
  return [
    ['WEEKLY_CUTOFF_DAY', 'THURSDAY', 'Locked product decision'],
    ['WEEKLY_CUTOFF_TIME', '17:00', 'Local workbook time; confirm before Sprint 2'],
    ['DELAY_THRESHOLD_PP', 10, 'Percentage points'],
    ['HANDOVER_REMINDER_DAYS', 7, 'Calendar days'],
    ['FOLLOWUP_REMINDER_DAYS', 3, 'Calendar days'],
    ['SI_REMINDER_DAYS', 7, 'Calendar days'],
    ['ESCALATION_LEVEL_1', 3, 'Days'], ['ESCALATION_LEVEL_2', 7, 'Days'],
    ['STALE_UPDATE_DAYS', 7, 'Days'], ['PLANNING_SYNC_INTERVAL', 15, 'Minutes'],
    ['PM_WEEKLY_REPORT_DAY', 'FRIDAY', 'Locked product decision'],
    ['EXEC_WEEKLY_REPORT_DAY', 'FRIDAY', 'Locked product decision'],
    ['FOUNDATION_ROWS', 1000, 'Minimum data row capacity; rerun setup after changing']
  ];
}

function foundationStatuses_() {
  var groups = {
    Role: ['Admin', 'Project Manager', 'Site Team', 'Management'],
    Project_Status: ['PLANNED', 'ACTIVE', 'ON HOLD', 'COMPLETED', 'CLOSED'],
    Discipline: ['Civil/Architectural', 'MEP', 'AC', 'Cargo Lift', 'Freight Lift', 'Passenger Lift', 'Travelator', 'Escalator'],
    Execution_Mode: ['AFTER PO', 'PARALLEL'],
    Commercial_Status: ['NOT SUBMITTED', 'QUOTATION SUBMITTED', 'UNDER REVIEW', 'APPROVED', 'PO PROCESS', 'PO ISSUED'],
    Execution_Status: ['UNSCHEDULED', 'SCHEDULED', 'ACTIVE', 'DUE SOON', 'DUE TODAY', 'OVERDUE', 'COMPLETED', 'CLOSED'],
    Deadline_Status: ['UNSCHEDULED', 'OPEN', 'DUE SOON', 'DUE TODAY', 'OVERDUE', 'WAITING VERIFICATION', 'CLOSED'],
    Lifecycle_Status: ['WAITING EXECUTION PLAN', 'ACTIVE', 'COMPLETED', 'WAITING VERIFICATION', 'CLOSED'],
    Health_Status: ['N/A', 'ON TRACK', 'AT RISK', 'DELAYED'],
    Reporting_Status: ['UPDATED', 'UPDATE DUE', 'UPDATE MISSING', 'STALE'],
    Verification_Status: ['NOT READY', 'WAITING VERIFICATION', 'VERIFIED'],
    Revision_Status: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
    Sync_Status: ['PENDING', 'SUCCESS', 'ERROR'],
    Health_Band: ['HEALTHY', 'ATTENTION', 'CRITICAL', 'CLOSED'],
    Vendor_Role: ['MAIN', 'SUPPORTING']
  };
  var rows = [];
  Object.keys(groups).forEach(function (category) {
    groups[category].forEach(function (value) { rows.push([category, value, true]); });
  });
  return rows;
}
