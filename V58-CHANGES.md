# Outcom V58 — Focused Product UX

## What changed

- Reduced the authenticated Command Center to the operating loop:
  - protected workflow count
  - healthy outcomes
  - open findings
  - findings that need attention
  - protected workflows
- Removed the long marketing-style assurance block from the authenticated dashboard.
- Made the connection selector show all four required platforms: n8n, Zapier, Make, and HighLevel.
- Rewrote connection instructions so the UI distinguishes:
  - n8n: direct connection with instance URL + API key; **not** an email/password login.
  - HighLevel: Location ID + Private Integration Token; not a HighLevel login password.
  - Zapier: real OAuth only when the Outcom deployment has Zapier OAuth credentials configured.
  - Make: OAuth when configured; advanced API-token route requires a Team ID and may require a paid plan.
- Removed misleading webhook-fallback language where no webhook endpoint existed in the product.
- Added honest unavailable states for Zapier and Make instead of dead-looking buttons.
- Moved HighLevel into the same first-step platform selector to reduce duplicate setup surfaces.
- Preserved the white Outcom logo lockup and visible sign-out treatment from V55.

## Important deployment note

V58 improves the product UX and makes provider limitations explicit. Zapier and Make cannot become functional OAuth integrations from frontend changes alone; the deployment still needs the corresponding provider OAuth credentials and callback configuration.
