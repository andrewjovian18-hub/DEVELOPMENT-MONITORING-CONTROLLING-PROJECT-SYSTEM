# Project Monitoring Control System

**Developer Package v1.0**  
Target: **Google Sheets + Google Apps Script**

This repository contains the approved requirements for a four-module project monitoring system.

## Modules
1. SRO — Special Request Order
2. Repair Handover Finding
3. Special Instruction (SI)
4. Outstanding Project

## Locked Product Decisions
- One Google Sheets workbook.
- One operational sheet per module.
- Default dashboard = **Executive Summary**.
- Main navigation = **module-centric**; Project is a secondary filter.
- Progress cut-off for SRO and Outstanding = **Thursday**.
- Friday = PM Operational Summary + Management Executive Summary.
- SRO and Outstanding = progress-driven.
- Repair Handover and SI = deadline-driven.
- SRO integrates with Team Planning and pushes actual progress back to Planning EXECUTION.
- Management receives a regular weekly summary, not only exception alerts.
- 1 row = 1 record.

## Documentation
- `docs/PRD.md`
- `docs/TECHNICAL_SPEC.md`
- `docs/DATA_DICTIONARY.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ACCEPTANCE_TESTS.md`
- `docs/wireframe.png`

## Development Order
1. Sprint 1 — Foundation
2. Sprint 2 — SRO Pilot
3. Sprint 3 — Outstanding
4. Sprint 4 — Repair Handover
5. Sprint 5 — Special Instruction
6. Sprint 6 — Dashboard
7. Sprint 7 — Automation
8. Sprint 8 — QA/UAT

## Product Principle
> The system should tell users what needs attention before they have to search for it.

See `AGENTS.md` before starting implementation.

## Sprint 1 implementation

See [foundation setup](docs/SETUP.md) to initialize a bound Google Sheets workbook with the scripts in `apps-script/`. Run `npm test` with Node.js 20+ for the dependency-free checks.

## Sprint 2 — SRO Pilot

See [SRO pilot setup and integration limits](docs/SPRINT_2_SETUP.md) for Planning mapping, Tender=100% creation, stable IDs, baseline/history, Thursday progress, audited edits and opt-in polling. Push-back and automatic source-ID writes are disabled by default. The supplied live source still requires access and format verification; local tests do not establish live deployment readiness. Other module engines remain deferred.
