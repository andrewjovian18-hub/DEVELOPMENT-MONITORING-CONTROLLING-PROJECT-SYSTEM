# Sprint 2 — SRO Pilot

This sprint adds Planning block parsing, Tender-gated SRO creation, baseline history, Thursday progress/health calculation, optional progress push-back, audited SRO editing, and opt-in Planning polling. Other module engines, reminders, reports and dashboard automation remain out of scope.

## Current integration status

Viewer access now works. The actual `SRO-2026` tab was inspected: 49 request blocks, 39 with Tender=100%, 10 below 100%. Among the qualifying items, 20 already have Execution=100% and 4 have partial progress. All 39 qualifying execution baselines match Finish minus Start. These are observations from one read-only snapshot, not permanent expected counts.

The new `SRO_2026` profile follows the observed narrative structure and was run locally against the captured values. Production ingestion remains gated on permanent source IDs and Project mapping: the source has no Planning_Sync_ID; its display number 35 appears twice. The user chose **Planning-team-owned ID setup with Viewer access retained**, and **SOURCE_ONCE** initial progress migration. No changes, ID writes, triggers, or Apps Script installation have been made in the live source. No monitoring destination was supplied. Source content/IDs and local captured data are not committed to this repository.

## Inspected SRO-2026 profile

Set `PLANNING_PROFILE=SRO_2026`, `PLANNING_INITIAL_ACTUAL=SOURCE_ONCE`, `PLANNING_PROVISION_IDS=FALSE`, and `PLANNING_PUSHBACK_ENABLED=FALSE`. The generic profile remains available for conventional column-mapped sources. The narrative layout is configurable through `PLANNING_LAYOUT_JSON`; defaults match the inspected sheet:

| Source | Meaning |
| --- | --- |
| Row 4, F:J | PROCESS / DURATION / START / END / PROGRESS headers |
| Row 6 onward | Request blocks beginning at DATA PREPARATIONS, followed by APPROVAL, TENDER, EXECUTION, COMPLETED |
| B/C labels, E values | STORE / LOCATION, REQUEST ITEM, ISSUER, REQUEST DATE, RO DATE |
| G/H/I on EXECUTION | Duration / Start / Finish |
| J on TENDER | The **only** eligibility progress value |
| J on EXECUTION | Progress copied once on initial import; later owned by SRO |
| J between blocks | AVERAGE summary; ignored for eligibility |
| A | Display number only; duplicate numbers are allowed and never used as identity |
| O4 and O on block-start rows | Dedicated Planning_Sync_ID header and immutable values, to be added by the Planning team |

The parser does not assume a fixed six-row stride: it finds block boundaries from process labels and validates metadata labels. It returns real source coordinates for later targeted writes, not row-derived keys. Existing notes in M/N and sparkline/summary cells are left alone. Unknown stages, malformed separators, reused IDs, occupied ID header columns and invalid qualifying dates fail explicitly.

`PLANNING_PROJECT_MAP_JSON` maps **exact location text** to active Project_ID values in the monitoring Project Master. Review spelling/aliases explicitly; no fuzzy matching or invented project IDs. `PLANNING_DATE_YEAR` defaults blank: set an explicit year only after reviewing source dates that lack four-digit years. The inspected source has three ambiguous date cells across two blocks (including `27 Maret` and `31 Maret 26`). Four-digit Indonesian dates and native Sheet dates need no fallback. A local diagnostic with year 2026 plus temporary in-memory keys/project mappings parsed all 49 blocks without warnings; that diagnostic did not create live IDs or authorize a date inference.

Run `previewPlanningSource` from the menu for a read-only readiness summary even before IDs/mappings are ready. It reports missing IDs/mappings and date problems and never writes to source or monitoring. Normal sync refuses qualifying records without permanent IDs, a Project mapping or valid dates.

Team ID setup: add `Planning_Sync_ID` at O4, then one distinct persisted UUID at each DATA PREPARATIONS row, preserving every existing column. Keep continuation ID cells blank. Protect the column; new request templates must generate a fresh persisted UUID. Do not copy an existing UUID, use a row-number formula, renumber IDs or derive them from request text. `PLANNING_PROVISION_IDS=TRUE` intentionally rejects the SRO_2026 profile because the user assigned ID maintenance to the Planning team; the generic profile's optional provisioning remains unchanged.

## Install or upgrade

1. Use a separate **monitoring** Google Sheet with Sprint 1 foundation. Copy all files from `apps-script/` into its bound Apps Script project, including the updated manifest. Do not install monitoring sheets in the Planning source.
2. The manifest now requests `spreadsheets` access for the separate Planning workbook and `script.scriptapp` for installable triggers. Enable the advanced **Google Sheets API v4** service (declared in the manifest); for a standard Cloud project, also enable Sheets API there. Reauthorize as the designated monitoring Admin. Workbook and Planning time zones must match.
3. Run `setupSroPilot` as that Admin. It preserves foundation data, seeds the additional Settings, installs one `sroOnEdit` trigger and opens only the supported SRO input columns. Existing SRO rows without a committed `99_SYSTEM` snapshot stop setup: migrate them explicitly rather than treating unverified rows as trusted.
4. Configure the source settings below. Complete an initial read-only parser test on a disposable copy before enabling a live poller.
5. Run `planningSyncJob` manually. It returns record/change/error counts and logs failures in `23_SYNC_LOG`; an invalid qualifying block aborts the inbound batch before record writes. It never creates a second SRO for the same Planning key.
6. To detect new items automatically, run **Enable Planning auto-sync** (`enablePlanningAutoSync`). It checks the whole source at `PLANNING_SYNC_INTERVAL` minutes (default 15; supported: 1, 5, 10, 15, 30). A new item is skipped below Tender 100% and created on the first successful poll after reaching 100%. This is polling, not instant push notification. The same installer must manage triggers; rerunning replaces that installer's existing poller. `disablePlanningAutoSync` stops only that job. No reminder/report jobs are installed.

## Source settings

| Setting | Meaning |
| --- | --- |
| `PLANNING_SPREADSHEET_ID` | Source workbook ID from its URL; required |
| `PLANNING_SHEET_NAME` | Exact tab name; user-supplied target is `SRO-2026` |
| `PLANNING_HEADER_ROW` | One-based row holding column labels; default 1 |
| `PLANNING_PROFILE` | GENERIC (default) or SRO_2026 |
| `PLANNING_LAYOUT_JSON` | Explicit SRO_2026 header/first-data rows and column numbers |
| `PLANNING_PROJECT_MAP_JSON` | Exact location to active Project_ID, for SRO_2026 |
| `PLANNING_DATE_YEAR` | Explicit fallback year for partial metadata dates; blank refuses inference |
| `PLANNING_INITIAL_ACTUAL` | ZERO (generic default), BLANK, or SOURCE_ONCE; use user-approved SOURCE_ONCE for this migration |
| `PLANNING_COLUMNS_JSON` | Logical fields → exact source header labels |
| `PLANNING_STAGES_JSON` | Recognized stage labels; defaults to DESIGN/APPROVAL/TENDER/EXECUTION/COMPLETED |
| `PLANNING_PUSHBACK_ENABLED` | Boolean FALSE by default; TRUE permits execution-progress writes and approved baseline revision writes, requiring Editor on the source |
| `PLANNING_PROVISION_IDS` | Boolean FALSE by default; optional TRUE provisions missing persistent UUIDs on new DESIGN rows, requiring Editor |
| `PLANNING_SYNC_INTERVAL` | Polling minutes; rerun enable after changing |
| `DELAY_THRESHOLD_PP` | Gap threshold in percentage points; default 10 |

Use actual Boolean values, not text `"true"`. Changing Settings does not grant Google Drive access. Viewer is sufficient for structure inspection and inbound sync when stable IDs already exist. Enabling a feature requiring writes does not bypass Viewer permissions.

Example column mapping (adapt the labels, not the logical keys):

```json
{"id":"Planning_Sync_ID","project":"Project_ID","item":"Request_Item","location":"Store_Location","issuer":"Issuer","requestDate":"Request_Date","roDate":"RO_Date","stage":"Stage","progress":"Progress","duration":"Duration","start":"Start","finish":"Finish"}
```

For the GENERIC profile, optional metadata keys `location`, `issuer`, `requestDate`, `roDate` can map to `null` when absent. Required keys cannot. Duplicate/missing/overlapping mapped headers are rejected. Generic dates must be actual Sheet date values; the narrative profile additionally supports validated Indonesian date strings and Sheets serial dates. Progress is a numeric fraction 0–1 (100% = 1), and duration a positive number. Text fields are limited to 2,000 characters; formula-like strings are rejected. Existing source formulas are read as values; direct writes to formulas remain rejected.

## Block contract and IDs

- Each logical request occupies a contiguous block of stage rows. Its stable key appears in the ID column on the first row; repeat the same key or leave ID blank on continuation rows. Metadata may appear once or be repeated consistently. Repeated conflicting metadata is an error.
- A different key or a completely blank row ends a block. The same key cannot appear in two separate blocks. Do not sort individual stage rows; move complete request blocks.
- Unknown/duplicate stages are errors. New DESIGN/APPROVAL-only blocks are valid and skipped. A Tender-complete block must include one EXECUTION row; blank execution dates/duration are permitted and produce `WAITING EXECUTION PLAN`. All other qualifying records require a recognized active Project_ID and item description.
- The ID must remain immutable when request text or row positions change. It may map to an existing immutable request ID. Descriptions, row numbers and row-number formulas are not suitable.
- If no source key exists, use a dedicated writable ID column. In optional `PLANNING_PROVISION_IDS=TRUE` mode, the poller validates the proposed structure and persists a random `PLAN-<UUID>` on each new first-stage (DESIGN by default) row lacking a key. It never overwrites a populated ID. This requires Editor and is disabled by default. Blank IDs in Viewer mode produce `SYNC_ID_NOT_FOUND`; the system cannot guarantee stable deduplication without a key.
- The source owner must protect the key column against later changes. No automated routine can identify a deleted/replaced key as the same request reliably.

## Ownership and lifecycle

Only Tender exactly 100% qualifies for import. If an already-created SRO's Tender regresses below 100%, the SRO and actual data are preserved, flagged `ERROR`, and no new metadata/baseline is imported. A removed source block also flags `SYNC_ID_NOT_FOUND` without deleting the SRO.

Planning owns request metadata and Current baseline. Original_Start/Original_Finish capture the **first complete valid pair** and never change. Execution Duration must equal Finish minus Start without +1; zero/reversed/mismatched durations fail explicitly. A valid Planning baseline revision updates Current and writes field-level History Log entries. This assumes upstream baseline edits have already followed the Planning team's approval process; there is no upstream approval field in the supplied specification.

SRO owns actual progress after initial import. `PLANNING_INITIAL_ACTUAL=SOURCE_ONCE` copies the source EXECUTION fraction only when creating a record, preserving existing completed/partial progress. Subsequent source changes never overwrite SRO actual. BLANK leaves initial actual for manual review; ZERO retains the generic initial behavior. None invents a Last_Progress_Update, Actual_Finish or PM verification. Initial 100% moves to WAITING VERIFICATION, not automatically CLOSED. Thursday planned progress uses calendar dates in workbook time zone and clamps 0–1; health uses the configured percentage-point threshold and overdue override. PM/Admin verification also requires Actual_Finish. A closed record cannot be edited through the pilot handler.

`Reporting_Status` is independent of health. A human progress update marks UPDATED. Missing/stale-update detection and weekly snapshots remain Sprint 7. The planned-progress checkpoint is the latest Thursday date per the locked formula, not a frozen snapshot at the configured cutoff time. `recalculateSroPilot` refreshes health manually; successful inbound polling also recalculates qualifying SROs.

## Editing and approvals

1. Add users through `saveMasterRecord` and explicit active User_ID/Project_ID grants in `14_USER_PROJECT_ACCESS`. These grants validate SRO edits; they do not provide row-level visibility security. Record direct grant changes in History Log. Share the monitoring workbook as Editor only with intended operational users; Management stays Viewer.
2. `setupSroPilot` grants Site/PM the supported input ranges. Refresh after access/master/grid changes with `refreshSroPilotAccess`; foundation/user refresh also preserves pilot protections once enabled.
3. Edit **one cell at a time** in an existing SRO. Site fields: Actual_Progress, Actual_Start, Actual_Finish, Issue, Mitigation, Remarks, Proposed_Finish, Revision_Reason. PM/Admin additionally control Main_Vendor, Supporting_Vendor, Revision_Status, Verification_Status. IDs, original/current baseline, computed state and timestamps stay protected.
4. The installed trigger validates the actual editor identity and project grant. Missing identity or unsupported fields fail closed. Invalid and multi-cell edits are restored from the ID-keyed committed snapshot. Use `updateSroRecord(id, patch)` for a controlled multi-field Admin update; direct Sheets paste is unsupported. PM/Site should use the installed sheet handler because it performs protected system writes as the installer while validating `e.user` as the editor.
5. A finish plus reason creates PENDING. PM/Admin selects APPROVED or REJECTED. Approval requires source Editor/push-back enabled and checks that the source baseline still matches the last imported baseline. For a literal Finish, it writes finish/duration. For the inspected same-row `Finish=Start+Duration` formula, it changes only Duration and preserves the formula. Other Finish formulas are rejected. Current is updated with audit; Original is preserved. Rejection retains the proposal and reason for history. Automatic approval is never inferred from source timing. This future Editor path remains disabled for the user's current Viewer connection.

## Push-back and recovery

Actual progress is committed locally with timestamps, audit and PENDING status **before** contacting Planning. The current source is reparsed and resolved by immutable ID immediately before targeting its EXECUTION progress cell. Sparse RAW batch writes preserve unrelated columns and Tender progress.

If push-back is disabled, permission is missing, a key disappears, a write target contains a formula, or the request fails, the new actual remains in SRO, Sync_Status becomes ERROR and Sync Log records the failure. Inbound sync does not clear this outbound error. After resolving access/configuration, an Admin runs a wrapper calling `retrySroPush('SRO-YYYY-0001')`; retry sends the latest committed actual, not a stale value. This is deliberate pending/error visibility even in Viewer-only mode.

`99_SYSTEM` holds committed SRO snapshots, not a second editable source. Unprocessed/manual changes, deleted rows or a partial record/snapshot write stop the next sync with PENDING_EDIT. Do not bypass this guard by deleting snapshots. Review History Log intents/completions and Sheets version history, then restore the last consistent record+snapshot under Admin control. No general migration/recovery tool is included in the pilot.

Google Sheets has no transaction spanning both workbooks. Concurrent Planning row moves between lookup and write remain a race; test on copies and avoid restructuring during a sync. Apps Script locks serialize this script's jobs, not human edits or other scripts. The pilot supports single-cell operational editing; simultaneous or rapid edits can be rejected for retry. Trigger event delivery and editor-email visibility require live Workspace verification. Owners/Admins can bypass protections; protections and hidden snapshots are not a security boundary against them. A failed baseline write acknowledgment can require reconciling Planning with the revision intent log before retry.

## Tests and live acceptance

Run `npm test` / `node --test tests/*.test.cjs`. No dependency installation is needed. The suite covers **30 passing local tests**: the previous 24 plus 6 narrative-profile/date/migration/formula-preservation cases. Acceptance tests 1–11, 25–27 and 37–39 remain covered locally. Committed fixtures are synthetic; they contain no source workbook records. Separately, the adapter parsed all 49 blocks/39 qualifying items from a read-only captured source snapshot, with readiness blockers reported; an in-memory simulation of IDs/mapping/year also passed. Neither is a live Apps Script deployment or permission/trigger test.

Before production, in disposable source and destination copies:

1. Viewer inspection and structure adaptation are complete. Have Planning add stable IDs, populate the destination Project Master and exact location mapping, confirm the year of partial dates and run the read-only preview. Verify no source writes in Viewer mode.
2. Create a new incomplete-Tender item, poll, finish Tender, poll twice; confirm exactly one SRO. Complete its baseline and confirm activation. Move the complete block and check ID stability.
3. Revise baseline and confirm Original unchanged and History populated. Verify the 60/62, 60/53 and 60/50 health cases, Thursday boundaries and time zones.
4. Enter actual as an assigned Site user; with push-back disabled confirm local persistence + ERROR. Grant Editor to the installer on the disposable source, enable push-back and retry; confirm only correct EXECUTION progress changes.
5. Verify PM-only approval/closure, blocked unknown identity/project, multi-cell rejection and pending-edit recovery. Test source access revoked and formula write targets.
6. Enable polling and verify a newly Tender-complete item is picked up within the configured interval. Inspect the installer's Apps Script Executions for failures; disable polling after the test.

The remaining live checks are **pending**, not represented by the local test results. The first source inspection is complete; the team-owned ID and destination configuration steps remain outstanding.

## Changed modules and next sprint

- `PlanningParser.gs`: configurable blocks, source reads and optional persisted UUIDs.
- `PlanningSro2026.gs`: inspected narrative layout, read-only preview and explicit Indonesian-date normalization.
- `SROSync.gs`, `SROStore.gs`: gated inbound sync, stable lookup, snapshots, audit and retryable push-back.
- `ProgressEngine.gs`: calendar baseline/Thursday progress and health.
- `SROEdits.gs`, `SROPermissions.gs`: allowed fields, project/role checks, revision/verification, installed edit handler and opt-in poller.
- `IDs.gs`, `PermissionEngine.gs`, `Triggers.gs`, manifest: foundation integration, batch ID reservation, menus/scopes/services.
- `tests/sro.test.cjs`, expanded test double: regression and acceptance coverage.

Sprint 3 remains the Outstanding workflow: manual record creation per contractor, reason/issue/recovery/PIC controls, reuse of the shared progress engine and module-specific editing. Deadline engines, reminders, weekly reports and dashboard automation remain in later planned sprints.
