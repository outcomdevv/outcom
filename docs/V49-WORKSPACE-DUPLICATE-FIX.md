# V49 — Workspace duplicate-slug recovery

## Fixed

After email confirmation, the first workspace bootstrap could create a row in
`public.workspaces` and then fail before creating the membership/settings rows.
The next request retried the same insert and returned PostgreSQL `23505` for the
unique `workspaces.slug` constraint.

`lib/auth.ts` now:

- Detects `23505` during workspace creation.
- Looks up the existing workspace by slug.
- Reuses it only when its `owner_id` matches the authenticated user.
- Idempotently upserts the membership and workspace settings rows.
- Never attaches a user to a workspace owned by someone else.
