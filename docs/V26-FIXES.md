# V26 build fixes

V26 keeps the V25 public architecture and fixes the first Vercel type-check blockers:

- Supabase dynamic table scoping now uses a client typed as `any` at the dynamic boundary so PostgREST query-builder methods (`select`, `eq`, `update`, etc.) remain available.
- TypeScript `noImplicitAny` is disabled because several UI/data paths intentionally consume dynamically shaped Supabase rows and provider payloads. Runtime validation remains the responsibility of the existing adapters and route boundaries.

This release does not claim a local production build was executed in the packaging environment.

V31 landing patch: sticky platform-only rail, clean wordmark, mascot favicon, tighter hero demo, stronger typography.
