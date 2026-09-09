# Sprint 1 setup

This is the foundation for Issue #1, not a production monitoring deployment. All 19 sheets are initialized; operational records and engines are deliberately absent.

## Initialize a workbook

1. Create a blank Google Sheet owned by the intended administrator. Confirm its locale and time zone in File → Settings. Do not initialize an unrelated workbook; setup adds sheets and applies protections.
2. Open Extensions → Apps Script. Copy every `.gs` file from `apps-script/` into the bound project, preserving filenames. Enable “Show appsscript.json manifest file” in project settings and copy the supplied manifest. Set the script time zone to match the workbook (the manifest starts at `Etc/UTC`; no locale is inferred).
3. Run `setupFoundation` as the owner. Authorize the workbook and email scopes. The first run records that signed-in email as the initial active Admin. A missing active-user email raises an error.
4. Confirm the 19 tabs, frozen headers, settings, statuses, named ranges and protections. Logs/system tabs and system columns are hidden. The Executive Summary tab is a labeled placeholder. No triggers, email jobs, integrations or dashboards are activated.
5. Add real master data with `saveMasterRecord` using a temporary wrapper function in the editor. Delete the wrapper after use. For example:

   ```javascript
   function addInitialMasters() {
     var projectId = saveMasterRecord('Project', {
       Project_Name: 'Example Project', Project_Status: 'ACTIVE',
       Project_Start: new Date(2026, 8, 1), Active: true
     });
     var vendorId = saveMasterRecord('Vendor', {
       Vendor_Name: 'Example Contractor', Discipline: 'MEP', Active: true
     });
     console.log({projectId: projectId, vendorId: vendorId});
   }
   ```

   A later update passes the returned ID as the third argument: `saveMasterRecord('Project', {Location: 'Site A'}, 'PRJ-0001')`. IDs and timestamp fields cannot be supplied or changed through this API. User creation uses `Full_Name`, `Email`, `Role`, `Active`; duplicate emails and removal of your own Admin access are rejected. User-master entries do not grant Drive file access.
6. Administrators may configure `90_SETTINGS` and `13_STATUS_MASTER`; record the reason and change in `21_HISTORY_LOG` when editing these cells directly. Rerun setup to refresh validations, named ranges and protections. Preserve Thursday cut-off and Friday reporting days. Confirm the assumed `17:00` cut-off before Sprint 2. Settings currently configure the foundation or reserve future-engine inputs; no scheduling occurs.
7. Share Management access as Viewer using Google Drive. Keep PM/Site access read-only during the foundation pilot. Run the live checklist below before widening access.

## Reruns, IDs and records

- Setup checks existing headers before any schema writes. A mismatch stops setup; resolve it explicitly instead of deleting or overwriting data. Matching sheets retain all rows; only missing seed keys/status pairs are appended. Unrelated sheets are untouched. Existing formatting on managed headers is refreshed.
- Default capacity is 1,000 data rows, configurable through `FOUNDATION_ROWS` (1–20,000). Setup does not shrink grids. Rerun after manually adding rows or editing master/status lists; master API calls refresh their dependent validation ranges automatically.
- Project/Vendor IDs use `PRJ-0001` / `VEN-0001`. Operational helpers reserve `SRO-YYYY-0001`, `HF-YYYY-0001`, `SI-YYYY-0001`, `OUT-YYYY-0001`; User uses the assumed `USR-0001` convention. Year comes from workbook time zone. A document lock encloses allocation and writes. Document Properties preserve counters after deletions; existing IDs are scanned to recover an imported higher number and detect duplicates. Gaps after failed writes are intentional. Never reset counters or regenerate IDs. Copying to a new bound script loses the counter history of deleted records and requires an explicit migration.
- Preserve one complete row per record when sorting. Never use row position as identity. The update helper searches by ID. Avoid direct cell edits to master IDs and timestamps; owners/Admins can bypass sheet protections, so the API is the supported audited write path.
- Project records have Created/Updated columns exactly as specified. Vendor/User timestamps and actors live in the History Log because their approved schemas have no timestamp columns. No columns were silently appended.
- Writes log intent before mutation and field changes after mutation. Errors are logged and rethrown. Sheets does not provide transactions: interruption or a log-service outage can leave an intent without a completed write, or a write without all follow-up entries. Reconcile by ID before retrying. Setup itself is rerunnable after partial failure.

## Protection conventions and limits

Sprint 1 applies enforced sheet protection, editable by active Admins and the workbook owner, and hides system columns/logs. It manages only protections with its `PMCS:foundation:` prefix; unrelated protections remain. Changing User roles through the API refreshes these editors. This establishes conservative defaults, not full role-based operational workflows.

Later operational handlers must open only: Site progress/actual dates, issue/mitigation/recovery, remarks/evidence and proposed finish/reason; PM schedule, revision approval, verification and commercial controls. IDs, original baselines, computed states and audit fields remain system-owned. Those editable-range handlers are deferred with their module sprints, as no reliable direct-edit auditing or baseline approval workflow exists yet.

Google Sheets filters and protections are not row-level security, nor do hidden tabs conceal data from viewers who can copy the workbook. `14_USER_PROJECT_ACCESS` is a future policy table, not enforced access filtering. Use a separate reporting surface in later work if Management must not access raw data. Group/owner permission behavior must be checked in the target Google Workspace environment. See [Google protection reference](https://developers.google.com/apps-script/reference/spreadsheet/protection) and [document property reference](https://developers.google.com/apps-script/reference/properties/properties-service).

## Assumptions and specification gaps

- Unspecified supporting schemas: Status = Category/Value/Active; Record Vendor Map = Module/Record_ID/Vendor_ID/Vendor_Role/Active; Settings = Key/Value/Description; System = Key/Value. Dashboard is a two-cell foundation label.
- Project statuses, verification/revision/sync vocabulary, vendor display format, `USR-` IDs and 1,000-row capacity are foundation defaults. They require product review. Explicit PRD values are seeded unchanged; `DUE TODAY` is included for SI because the technical deadline engine defines it.
- SI retains exactly one Vendor_ID. Commercial_Status and Execution_Status have separate dropdowns. Vendor dropdowns contain IDs from the master (including inactive vendors for historical references); assigning active vendors, discipline matching and operational record validation belong to module creation services in later sprints.
- `Main_Vendor` and `Supporting_Vendor` are single IDs; the map sheet reserves multi-vendor relationships. No referential-integrity delete operation is provided; deactivate masters instead.
- There is no supplied `docs/wireframe.png` despite its README reference. No visual dashboard design is invented here.

## Validation

From the repository root with Node.js 20 or later, run `npm test` (or `node --test tests/*.test.cjs`). No packages need installing. The suite executes the `.gs` modules against an in-memory Apps Script test double and checks all schemas, repeat setup, persistent IDs after sort/deletion/import/year change, immutable fields, timestamps/audit, failure handling, access checks and validation rules.

Relevant existing acceptance checks: 21 (single vendor column and range validation), 22 (AFTER PO/PARALLEL only), 23 (separate commercial/execution status validation), 38 (typed master dates and date validation). These are foundation portions only; operational creation, deadline behavior and all other acceptance checks remain deferred to their sprints.

Live checklist — **not executed in this change; no target workbook was supplied**:

1. Run setup twice in a disposable bound workbook; confirm 19 managed tabs, no duplicate seeds/protections, unchanged entered data/settings and 12 required named ranges.
2. Add/update a Project/Vendor/User using wrappers; sort complete master rows and update by ID; verify IDs and creation timestamps persist, updated timestamps advance and history identifies the same ID.
3. Inspect SI dropdowns; try an invalid execution mode, multiple vendor IDs in one cell, invalid date and progress outside 0–100%. Confirm rejection by validation. Admin pasting can replace validation; rerun setup if needed.
4. As a separate non-Admin editor, confirm managed sheets reject edits. As Viewer, confirm no writes. Check group/domain access and owner override explicitly.
5. Modify a setting/status, rerun and confirm preservation and refreshed dropdowns. Verify time zones agree and no time-driven trigger or outgoing email exists.

## Changed files and Sprint 2 handoff

- `apps-script/Config.gs`, `Defaults.gs`: schemas and initial configuration.
- `Setup.gs`, `Validation.gs`, `PermissionEngine.gs`: workbook bootstrap and controls.
- `Utils.gs`, `IDs.gs`, `Audit.gs`, `Masters.gs`: locks, identity, validation, ID/timestamp/audit and master API.
- `Triggers.gs`, `appsscript.json`: menu and minimal bound-script manifest.
- `tests/`: executable foundation checks; `package.json`: dependency-free test command.
- This setup guide and README setup link.

Sprint 2 remains: Planning block parser and stable Planning_Sync_ID, Tender=100% SRO creation with duplicate prevention, incomplete-baseline lifecycle, original/current baselines and revision history, calendar-day Thursday progress engine and configurable threshold, actual-progress push-back, Sync Log/error recovery, and the related audited PM/Site edit handler. Reminders, reports, dashboard automation and other module engines remain assigned to later sprints in IMPLEMENTATION_PLAN.md.
