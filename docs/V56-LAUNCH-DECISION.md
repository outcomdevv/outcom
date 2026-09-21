# V56 — Launch decision

## Product decision

For the first public release, Outcom ships one reliable native integration: **n8n**.

The launch loop is intentionally narrow:

1. Connect an n8n instance with an instance URL and API key.
2. Discover the user's workflows.
3. Select one workflow.
4. Describe the expected business outcome.
5. Protect the workflow and create the first outcome checks.
6. Review proof or investigate a mismatch.

Zapier and Make are not shown as selectable connection paths in the MVP UI until their OAuth/webhook paths are fully tested end-to-end. Their backend work remains in the repository for later activation.

## Why this decision

- n8n has a native read-only API path already implemented.
- It does not require the user to share an email or password.
- Outcom can inspect workflow topology and execution history without adding nodes to the customer's workflow.
- Showing unavailable OAuth buttons creates false confidence and onboarding friction.
- A narrow, working product is more valuable this week than four partially working integrations.

## Security rules

- Never request a provider password.
- Store API keys encrypted on the server.
- Ask for the smallest practical read-only permission set.
- Do not claim an outcome verdict when the downstream system cannot be verified.
