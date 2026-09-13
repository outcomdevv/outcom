# Provider Matrix

| Provider | User connection | Observer input | Downstream role | Public status |
|---|---|---|---|---|
| n8n | Instance URL + API key | Workflow definitions + execution history | Any supported downstream adapter | Native observer implemented |
| HighLevel | OAuth 2.0 / PIT fallback | CRM state | Downstream business truth | Read-only adapter implemented |
| Make | OAuth 2.0 / API token fallback | Scenario list + blueprint/log APIs | Future downstream adapters | Connection + discovery implemented |
| Zapier | Powered by Zapier OAuth | Zaps / Workflow API | Future downstream adapters | OAuth + discovery implemented; provider approval required |

## Least privilege

Make's `scenarios:read` scope is sufficient for reading scenario details and blueprints; write scopes are separate.

Zapier's Workflow API uses OAuth 2.0 user access tokens and account-wide Zap visibility depends on the requested scopes.

n8n is intentionally connected with a native API key rather than asking the user for a password or session cookie.

HighLevel uses OAuth read scopes for the public flow; PIT remains available as a design-partner fallback.
