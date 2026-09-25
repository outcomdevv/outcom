# Outcom V58 — Dark Contrast + Integration Research

## Product fixes
- Hardened dark-mode contrast across the simplified Connect flow: hero card, stepper, platform cards, setup instructions, forms, outcome choices, business-system panel, alerts, and footer.
- Kept the Outcom logo lockup on a white pill so the wordmark cannot disappear on the dark sidebar.
- Clarified that n8n connection is **instance URL + API key**, not email/password.
- Clarified that Make API tokens are an advanced/plan-gated path and should not be the default onboarding route.
- Removed misleading language that implied a webhook URL already existed when the UI did not actually display one.

## Integration decision
1. **n8n:** Native API connection first. n8n's public REST API uses an API key from Settings → n8n API. n8n states the API is not available during its free trial; non-Enterprise API keys have full account access, while Enterprise can scope keys. Use a dedicated key for Outcom.
2. **HighLevel:** For the MVP, use a scoped Private Integration Token + Location ID. HighLevel documents PITs as scoped, fixed tokens. For the public multi-client product, move to HighLevel OAuth so users simply authorize Outcom.
3. **Zapier:** For the public product, use Zapier OAuth / Workflow API access when the Outcom Zapier application is configured. Do not ask users for their Zapier password. Zapier documents OAuth 2.0 and API-key connection methods, and its Workflow API supports OAuth authorization.
4. **Make:** Do not make users purchase a paid Make API plan just to paste a token. Make documents API access as plan-gated in its developer documentation. The product path should be OAuth when Outcom's Make OAuth client is configured; otherwise use a workflow/webhook bridge.

## Critical product gap found
The V57 UI described webhook fallbacks but did not actually render a unique Outcom webhook URL. V58 therefore avoids pretending that the fallback is already complete. Before calling the webhook path production-ready, Outcom needs a signed, workspace/workflow-specific inbound webhook endpoint and a one-click copy UI.
