# AGENTS.md

## Project Mission
Build the Project Monitoring Control System defined in `/docs` using Google Sheets + Google Apps Script.

## Read First
Before editing code, read in this order:
1. `docs/PRD.md`
2. `docs/TECHNICAL_SPEC.md`
3. `docs/DATA_DICTIONARY.md`
4. `docs/IMPLEMENTATION_PLAN.md`
5. `docs/ACCEPTANCE_TESTS.md`

## Current Development Scope
Start with **Sprint 1 — Foundation only** unless the user explicitly approves moving to the next sprint.

Sprint 1 includes:
- workbook/sheet structure;
- project/vendor/user/status/settings masters;
- unique ID generation;
- timestamp helpers;
- named ranges;
- data validation/dropdowns;
- sheet protection conventions;
- starter Apps Script project structure;
- basic setup/bootstrap function;
- README/setup instructions.

Do not implement full SRO sync, reminders, reporting, or dashboard automation yet in Sprint 1.

## Engineering Rules
- 1 row = 1 record.
- Never use row number as a persistent key.
- Use immutable IDs.
- Use batch reads/writes; avoid per-cell loops.
- Use formulas for simple calculations and Apps Script for workflow/automation.
- No silent failures.
- Preserve auditability.
- Keep user-facing sheets simple; hide/protect system fields.
- Google Sheets filters are not row-level security.
- Keep configurable thresholds in `90_SETTINGS`; do not hard-code business rules where avoidable.

## Apps Script Structure
Prefer modular files:
- `Config.gs`
- `Utils.gs`
- `IDs.gs`
- `Audit.gs`
- `SROSync.gs`
- `ProgressEngine.gs`
- `DeadlineEngine.gs`
- `ReminderEngine.gs`
- `ReportingEngine.gs`
- `DashboardEngine.gs`
- `PermissionEngine.gs`
- `Triggers.gs`

For Sprint 1, create only the modules needed for foundation plus placeholders where useful.

## Quality Gate
Before finishing a sprint:
- run the relevant acceptance tests from `docs/ACCEPTANCE_TESTS.md`;
- document setup steps;
- summarize changed files;
- list open assumptions/risks;
- do not silently change locked requirements.

## Product Decisions That Are Locked
- Weekly cut-off for SRO and Outstanding: Thursday.
- Friday: PM operational summary + Management executive summary.
- Dashboard default: Executive Summary.
- Dashboard navigation: module-centric, Project as secondary filter.
- SRO and Outstanding are progress-driven.
- Handover and SI are deadline-driven.
- 1 SI = 1 Vendor.
- Management gets regular weekly summary, not only exception alerts.
