# Provider Matrix — V59

| Provider | Connection path | Real observation path | Downstream role | Status |
|---|---|---|---|---|
| n8n | Instance URL + API key | Native REST execution history | Can verify HighLevel state | Implemented |
| HighLevel | Scoped Private Integration Token or OAuth | Read-only CRM state | Business system of truth | Implemented |
| Make | API token/OAuth or webhook mode | Native scenario logs when API is available; outbound HTTP webhook otherwise | Can verify HighLevel state | Implemented |
| Zapier | OAuth when configured; webhook mode otherwise | Outbound Webhooks by Zapier POST to private Outcom endpoint | Can verify HighLevel state | Implemented |

## Webhook direction

For Zapier and Make, Outcom is the receiver. The automation platform sends a final execution payload to a unique Outcom URL generated for the protected workflow.

- Zapier: use **Webhooks by Zapier → POST**. Zapier generates Catch Hook URLs for receiving data, while an Outcom webhook URL is the destination of the Zap's final action.
- Make: use **HTTP → Make a request** to POST the execution payload to Outcom. Do not use Make's Custom webhook for this direction because Custom webhook receives data into Make.

The Outcom URL contains a high-entropy secret token. The raw token is encrypted at rest and lookup uses a SHA-256 hash. Duplicate execution IDs are ignored.

## Least privilege

n8n API keys can be scoped on Enterprise; non-Enterprise API keys have full account access, so use a dedicated key. HighLevel Private Integrations are scoped and static. Make API tokens use explicit read/write scopes. Zapier webhook mode avoids storing a Zapier account password or API key in Outcom.
