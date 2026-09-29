# V76 — Evidence Graph

## Purpose
Turn Outcom's existing evidence array into a traceable, human-readable chain:

`EXECUTION → EXPECTATION → EVIDENCE → VERIFICATION → BUSINESS OUTCOME`

## What changed
- Added `/evidence` Evidence Graph page.
- Added Evidence Graph to workspace navigation.
- Graph uses persisted workflows, contracts, events, and incidents; no fake evidence is generated.
- Latest finding gets a full graph with execution, protected outcome, evidence points, verification state, and final business outcome.
- Older findings appear in an evidence ledger with direct links to the finding.
- No database migration is required.

## Product boundary
V76 visualizes and explains evidence already collected by Outcom. It does not yet execute recovery actions. Real workflow recovery belongs to V77.
