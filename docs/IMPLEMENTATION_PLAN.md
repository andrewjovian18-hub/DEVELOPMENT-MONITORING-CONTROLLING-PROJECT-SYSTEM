# Implementation Plan

## Sprint 1 — Foundation
Workbook structure, masters, Settings, IDs, timestamps, protections, dropdowns.

## Sprint 2 — SRO Pilot
Planning parser, sync key, Tender 100% creation, execution baseline, original/current baseline, validation, progress engine, progress push-back, Sync Log, errors.

## Sprint 3 — Outstanding
Reuse shared progress engine; add reason/issue/recovery controls.

## Sprint 4 — Repair Handover
Intake staging, PM include/exclude, finding creation, deadline engine, H-7/H-3/H-0, overdue, verification, closure.

## Sprint 5 — SI
Manual creation, one SI/one vendor, discipline/vendor linkage, AFTER PO/PARALLEL, commercial status, execution deadline, reminders, closure.

## Sprint 6 — Dashboard
Build unified dataset and Executive + module views. Action Required is the main content area.

## Sprint 7 — Automation
Thursday reminders/snapshot/missing check; daily deadline; escalation; Friday PM and Management reports.

## Sprint 8 — QA/UAT
Duplicate prevention, sync stability, changed source structure, missing IDs, revisions, permissions, reminder duplication, health transitions, snapshot uniqueness, report accuracy.

## Apps Script files
Config.gs, Utils.gs, IDs.gs, Audit.gs, SROSync.gs, ProgressEngine.gs, DeadlineEngine.gs, ReminderEngine.gs, ReportingEngine.gs, DashboardEngine.gs, PermissionEngine.gs, Triggers.gs.

## onEdit responsibilities
Identify sheet/record/user; validate editable field; audit change; update timestamps; if SRO progress changed recalc and push to Planning; if Outstanding progress changed recalc; populate vendor details; mark proposed finish PENDING; process verification.

## Named ranges
cfg_CUTOFF_DAY, cfg_CUTOFF_TIME, cfg_DELAY_THRESHOLD, cfg_HANDOVER_REMINDER, cfg_FOLLOWUP_REMINDER, cfg_ESCALATION_L1, cfg_ESCALATION_L2, cfg_STALE_DAYS; rng_ProjectMaster, rng_VendorMaster, rng_UserMaster, rng_StatusMaster.

## UX/Protection
Site Team edits only operational input fields; PM gets schedule/revision/verification/commercial controls; Management is view-only; Admin full access. Google Sheets protection is not true row-level security.

## Wireframe
Use the approved wireframe visual direction: clean corporate, minimal dashboard gridlines, compact filter row, four module cards, large Action Required area, limited charts, status chips, simplified management view.
