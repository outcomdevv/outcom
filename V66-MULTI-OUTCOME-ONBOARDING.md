# V66 — Multi-Outcome Protection Onboarding

## What changed
- The Connect flow now lets a user select **one or more** supported outcome checks.
- Each selected outcome is sent to the protection API as a separate verification contract.
- Supported deterministic checks in this MVP:
  - A contact / record exists → `record_exists`
  - Existing contact tags are preserved → `state_invariant`
  - At least one output was produced → `output_count`
- The UI explains that these checks do not change the Zap/Make automation. They define the business state Outcom verifies after execution.
- Inbound webhook events infer `output_count = 1` when a `target_record_id` is present, unless the provider explicitly sends an output count.
- Duplicate outcome contracts are avoided by outcome type + label.

## Verification
- TypeScript syntax was checked with the installed TypeScript compiler via `transpileModule` for the modified TS/TSX files.
- A full Next.js typecheck/build could not be run because this extracted ZIP has no installed dependency tree / lockfile in the environment.
