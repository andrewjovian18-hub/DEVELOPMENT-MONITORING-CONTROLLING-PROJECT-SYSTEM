# Product Requirements Document

## 1. Product Overview
Project Monitoring Control System centralizes four active-project monitoring workflows in one Google Sheets workbook and presents them through a management-friendly Master Dashboard.

### Users
- Admin
- Project Manager
- Site Team
- Top Management

## 2. Problem Statement
Current monitoring is fragmented across several Sheets and manual follow-up. The system must reduce duplicate input, detect risk earlier, preserve target/history changes, automate reminders, and provide one management view.

Target flow: **Data → Monitoring → Warning → Action → Reporting**.

## 3. Roles
### Admin
Full system/master/settings/log access.
### Project Manager
Create/edit records, define targets, assign vendors, approve revisions, verify/close, receive operational report.
### Site Team
Update permitted operational fields such as actual progress, actual dates, issue, mitigation/recovery, remarks, repair evidence.
### Management
Dashboard/reporting only; no raw operational input required.

# 4. Module 1 — SRO
## Source and Trigger
Planning flow: DESIGN → APPROVAL → TENDER → EXECUTION → COMPLETED.
- When **Tender Progress = 100%**, create SRO if absent.
- Initial lifecycle: `WAITING EXECUTION PLAN`.
- Activate monitoring when Execution Duration, Start, and Finish are complete.

## Data Ownership
Planning owns request metadata and execution baseline. SRO owns actual execution monitoring.

## Two-Way Sync
Planning → SRO: baseline.
SRO → Planning: actual progress to EXECUTION progress.
A stable `Planning_Sync_ID` is mandatory.

## Progress
One SRO = one total actual progress %. No Curve-S breakdown.
Weekly cut-off: **Thursday**. Duration basis: calendar days, Monday–Sunday.

## Planned Progress
Planned progress is time-based at the Thursday checkpoint.
`Planned = Elapsed calendar duration / Total duration`.

## Health
- Actual ≥ Planned → ON TRACK
- Gap < 10 pp → AT RISK
- Gap ≥ 10 pp → DELAYED
- Today > Current Finish and Actual < 100% → DELAYED
- 100% → completion lifecycle
Threshold configurable in Settings.

## Reporting Status
Separate from schedule health: UPDATED / UPDATE DUE / UPDATE MISSING / STALE.

# 5. Module 2 — Repair Handover Finding
Source is another team's narrative Handover Google Sheet. Use a **controlled intake**.

Flow: Source → Handover Intake → PM review → Include as Finding → Finding record.

Red text can flag a Potential Finding but formatting alone must never create a finding automatically.

No progress %. Monitor Start Date and Target Finish.
Statuses: UNSCHEDULED / OPEN / DUE SOON / DUE TODAY / OVERDUE / WAITING VERIFICATION / CLOSED.
Default reminders: H-7, H-3, H-0, overdue.

# 6. Module 3 — Special Instruction
Manual PM input based on issued SI form.
**1 SI = 1 Vendor**.

Disciplines include Civil/Architectural, MEP, AC, Cargo Lift, Freight Lift, Passenger Lift, Travelator, Escalator.

Execution Modes:
- AFTER PO
- PARALLEL

Commercial Status: NOT SUBMITTED / QUOTATION SUBMITTED / UNDER REVIEW / APPROVED / PO PROCESS / PO ISSUED.

Execution Status: UNSCHEDULED / SCHEDULED / ACTIVE / DUE SOON / OVERDUE / COMPLETED / CLOSED.

No progress %. Monitor start and finish dates. Default reminders: H-7, H-3, Due Today, Overdue.

# 7. Module 4 — Outstanding Project
Manual PM/Site input based on Curve S, Site Report, Site Inspection, or Coordination Meeting.
**1 Outstanding record = 1 Contractor**.

Actual progress is manually entered as one total %. Planned progress is time-based from Start to Current Target Finish.
Weekly cut-off = Thursday. Health logic matches SRO.

Required controls: Outstanding Reason, Issue/Constraint, Recovery Action, PIC, Remarks.

# 8. Dashboard
Default = Executive Summary. Navigation is module-centric. Secondary filters: Project, Vendor, Status, Period.

Universal health bands: HEALTHY / ATTENTION / CRITICAL / CLOSED.

Action Required must be more prominent than charts. Priority: Overdue → Delayed → Due Today → Due ≤3 days → At Risk → Missing Update.

# 9. Weekly Reporting
## Thursday
- update reminder
- weekly cut-off
- progress snapshot
- missing-update detection
- dashboard refresh

## Friday PM Operational Summary
SRO At Risk/Delayed/Missing; Handover Due Soon/Overdue; SI Due/Overdue/Commercial Pending; Outstanding At Risk/Delayed/Missing; new, closed, revised targets.

## Friday Management Executive Summary
Overall health, module summary, critical items, new vs closed, week-on-week trend, top 5–10 critical records.

# 10. Schedule Revision
Never overwrite original target. Use Original Target, Current Target, Proposed Finish, Revision Reason, Revision Status. PM approval updates current target and writes history.

# 11. Closure
Operational Completion → Ready for Verification → PM Verification → CLOSED.

# 12. MVP
Four modules, dashboard, masters, permissions, SRO sync and push-back, Thursday progress engine, Handover/SI deadline engine, reminders/escalation, logs, weekly PM report, weekly Management report, configurable Settings.
