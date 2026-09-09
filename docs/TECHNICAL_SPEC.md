# Technical Specification

## 1. Workbook Structure
```text
00_DASHBOARD
01_SRO
02_HANDOVER_FINDING
03_SPECIAL_INSTRUCTION
04_OUTSTANDING
10_PROJECT_MASTER
11_VENDOR_MASTER
12_USER_MASTER
13_STATUS_MASTER
14_USER_PROJECT_ACCESS
16_RECORD_VENDOR_MAP
20_PROGRESS_LOG
21_HISTORY_LOG
22_REMINDER_LOG
23_SYNC_LOG
24_HANDOVER_INTAKE
90_SETTINGS
98_DASHBOARD_DATA
99_SYSTEM
```

## 2. Database Rule
All operational modules use **1 row = 1 record**.

## 3. IDs
Project `PRJ-0001`, Vendor `VEN-0001`, SRO `SRO-YYYY-0001`, Finding `HF-YYYY-0001`, SI `SI-YYYY-0001`, Outstanding `OUT-YYYY-0001`. IDs are immutable.

## 4. Progress Engine
Used by SRO and Outstanding.
- Cut-off: Thursday.
- Calendar-day duration.
- Convention: `Duration = Finish - Start` without +1 to match Planning.

Latest Thursday concept:
```excel
=TODAY()-MOD(WEEKDAY(TODAY(),2)-4,7)
```

Planned progress:
```excel
=MAX(0,MIN(1,(MIN(Reporting_Cutoff,Current_Finish)-Current_Start)/Duration_Days))
```

Variance pp:
`(Actual - Planned) * 100`.

Health priority:
1. incomplete baseline → N/A
2. Actual = 100% → completion lifecycle
3. Today > Finish and Actual < 100% → DELAYED
4. Actual ≥ Planned → ON TRACK
5. gap < configured threshold → AT RISK
6. otherwise DELAYED

## 5. Deadline Engine
Used by Handover and SI.
- no target → UNSCHEDULED
- >7 days → OPEN/ACTIVE
- 1–7 → DUE SOON
- 0 → DUE TODAY
- <0 → OVERDUE
- vendor completed → WAITING VERIFICATION
- PM verified → CLOSED

## 6. SRO Planning Integration
Planning source is block-oriented. Parser must identify request blocks, find TENDER and EXECUTION, detect Tender = 100%, read execution baseline, and create/update SRO.

Do not use row number or description as the persistent key. Use `Planning_Sync_ID`.

Planning → SRO: metadata and baseline.
SRO → Planning: actual execution progress.

If push-back fails, preserve SRO actual progress, set Sync Status ERROR, log the failure.

## 7. Thursday Snapshot
Every active SRO/Outstanding receives one weekly snapshot. Unique key: `Module + Record_ID + Cutoff_Date`.

## 8. Audit
Log Timestamp, User, Module, Record ID, Field, Old, New, Change Source (USER/SYSTEM/PLANNING_SYNC). Target revisions are always logged.

## 9. Reminder Engine
Evaluate condition → check Reminder Log → skip duplicate state → send → log. Avoid daily spam.

Default escalation: At Risk to Site/PIC; Delayed to Site+PM; Day 3 Level 1; Day 7 Level 2.

## 10. Dashboard Dataset
Normalize modules in `98_DASHBOARD_DATA` with: Module, Record_ID, Project, Vendor, Item, Lifecycle, Module_Status, Health_Band, Due_Date, Remaining_Days, Planned, Actual, Variance, Reporting_Status, Last_Update, Critical_Flag, Attention_Reason, Priority_Score.

Map On Track/Open → HEALTHY; At Risk/Due Soon → ATTENTION; Delayed/Overdue → CRITICAL; Closed → CLOSED.

Suggested priority: Overdue 100, Delayed 90, Due Today 80, Due ≤3d 70, At Risk 60, Missing Update 50.

## 11. Apps Script Structure
```text
Config.gs
Utils.gs
IDs.gs
Audit.gs
SROSync.gs
ProgressEngine.gs
DeadlineEngine.gs
ReminderEngine.gs
ReportingEngine.gs
DashboardEngine.gs
PermissionEngine.gs
Triggers.gs
```

Recommended jobs: planningSyncJob, dailyHealthJob, dailyDeadlineJob, thursdayReminderJob, thursdaySnapshotJob, thursdayMissingUpdateJob, fridayPMReportJob, fridayExecutiveReportJob, dashboardRefreshJob.

## 12. Performance
Use batch reads/writes, in-memory lookup maps, minimal volatile formulas, LockService for concurrent sync when needed, and avoid per-cell Apps Script loops.

## 13. Errors
SYNC_ID_NOT_FOUND, DUPLICATE_RECORD, INVALID_DATE, BASELINE_MISMATCH, PLANNING_STRUCTURE_CHANGED, EMAIL_NOT_FOUND, INVALID_VENDOR, INACTIVE_VENDOR, PERMISSION_DENIED. No silent failure.
