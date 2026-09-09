# Acceptance Tests

## SRO
1. Tender reaches 100% → exactly one SRO is created.
2. Tender 100% but execution baseline incomplete → WAITING EXECUTION PLAN.
3. Baseline complete → monitoring activates.
4. Baseline revision updates Current but preserves Original and writes History Log.
5. Thursday planned progress uses calendar duration and clamps 0–100%.
6. Planned 60 / Actual 62 → ON TRACK.
7. Planned 60 / Actual 53 → AT RISK (-7 pp).
8. Planned 60 / Actual 50 → DELAYED (-10 pp).
9. Today past Finish and Actual <100 → DELAYED override.
10. Actual progress update pushes to Planning EXECUTION and writes Sync Log.
11. Failed push does not erase SRO actual progress and logs ERROR.

## Outstanding
12. PM/Site can create one record for one contractor.
13. Thursday plan vs actual uses same engine as SRO.
14. One weekly snapshot per active record/cut-off.

## Handover
15. Source note does not become a Finding until PM includes it.
16. Red note only flags potential finding.
17. Target 7 days away → DUE SOON.
18. H-7 reminder sends once and logs.
19. Duplicate identical H-7 reminder is prevented.
20. Vendor completion → WAITING VERIFICATION; PM verification → CLOSED.

## SI
21. One SI can reference only one Vendor_ID.
22. Execution Mode only AFTER PO or PARALLEL.
23. Commercial and Execution statuses remain independent.
24. Deadline status follows target date.

## Revision
25. Site proposes finish + reason; PM approves/rejects.
26. Approval updates Current, not Original.
27. Revision writes audit history.

## Weekly Reporting
28. Thursday snapshot is unique by Module + Record + Cutoff.
29. Missing update sets UPDATE MISSING without automatically setting DELAYED.
30. Friday PM report includes actionable operational items.
31. Friday Management report includes overall health, module summary, critical items, new/closed, trend.

## Dashboard
32. Default opens Executive Summary.
33. Module selector changes KPIs/details.
34. Project filter scopes records.
35. Universal health mapping is correct.
36. Overdue/Delayed rank above At Risk/Missing Update.

## Error Handling
37. Missing sync ID logs SYNC_ID_NOT_FOUND.
38. Invalid dates are rejected/flagged.
39. Parser failure logs PLANNING_STRUCTURE_CHANGED.
40. Missing reminder email is logged; no silent failure.
