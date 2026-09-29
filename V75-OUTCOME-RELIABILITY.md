# V75 — Outcome Reliability Engine

V75 turns individual verification results into a historical reliability layer.

## What it measures

- Outcome checks observed across protected workflows.
- First-check verified vs failed outcomes.
- Reliability percentage by workspace and workflow.
- Open findings.
- Seven-day reliability trend.
- Recent outcome failures.
- Average time to resolution for resolved findings.

## Definition

**First-check reliability** = `(evaluated outcome checks - recorded finding events) / evaluated outcome checks`.

A repaired finding remains part of historical reliability. Repair changes the current state of the incident, but it does not erase the fact that the original execution failed its business outcome check.

## Storage boundary

V75 intentionally uses existing `events`, `contracts`, and `incidents` data. No new database migration is required for this milestone.
