# Outcom V60 — Production webhook + loading UX

## Fixes
- Production inbound webhook URLs no longer fall back to `http://localhost:3000` on Vercel.
- URL resolution order: explicit app URL, Vercel production URL, Vercel deployment URL in production, then the current production-domain fallback.
- Added webhook rotation so an exposed webhook URL can be invalidated without deleting the protected workflow.
- Updated webhook sample metadata to V60.
- Added one Outcom mascot loading language for route loading, dashboard navigation, landing-page navigation, sign-up, and sign-in.
- Added the same small mascot animation to connection/action buttons.

## Zapier setup reality
Webhook mode is intentionally credential-free, but Zapier still requires the customer to add an outbound POST action to the Zap. V60 reduces the setup to: create the protected Zap in Outcom → copy the private URL → add one Webhooks by Zapier POST step → paste the URL → send the JSON Outcom shows. A truly one-click Zap creation flow would require a deeper Zapier-native app/workflow provisioning path; a generic webhook endpoint cannot create or edit a customer's Zap by itself.
