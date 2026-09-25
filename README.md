# Outcom Public MVP V25

Outcom is a business-outcome assurance layer for automation agencies.

> **Green execution. Wrong outcome.**

The public build is intentionally different from the local prototype. It is multi-user, workspace-scoped, persistent, and designed for people outside the developer machine.

## Public architecture

```text
User
  │
  ▼
Next.js / Vercel
  │  Supabase Auth cookies
  ▼
Supabase PostgreSQL
  ├─ workspaces + memberships
  ├─ workflows / contracts / events
  ├─ incidents / state snapshots
  ├─ encrypted provider credentials
  └─ encrypted workspace Operator key
          ▲
          │
Cloudflare Worker Cron (every 5 min)
          │
          ▼
/api/cron/observe
          │
          ├─ n8n native API
          ├─ Make observer (adapter-ready)
          └─ Zapier observer (adapter-ready)

HighLevel is used as the read-only downstream business-state system.
```

### Why this is not the local build

The local prototype used SQLite on the developer machine and a local Node observer process. V25 removes that dependency for the public product. Data is stored in Supabase PostgreSQL and users are authenticated with Supabase Auth. Provider credentials are encrypted before they are persisted.

Supabase Auth supports password, magic-link, OTP and social/SSO methods; this build starts with email/password and is ready for additional providers. Supabase recommends combining Auth with Postgres Row Level Security for row-level authorization. 

## Data durability

There is no SQLite database in V25. Workspaces, integrations, contracts, executions, incidents and snapshots live in PostgreSQL.

For a design-partner preview, Supabase Free is sufficient. It is persistent storage, but free projects can be paused after inactivity; pausing is not the same as deleting the data. For a paid $500–$1,000/month production service, use a commercial Supabase plan and establish backups/retention appropriate for client data.

## 1. Create Supabase project

Create a project in Supabase and run:

```text
supabase/migrations/001_public_architecture.sql
```

The migration creates:

- `workspaces`
- `workspace_members`
- `workflows`
- `contracts`
- `events`
- `incidents`
- `connections`
- `oauth_states`
- `monitors`
- `state_snapshots`
- `webhooks`
- `contacts`
- `workspace_settings`

Every business table carries `workspace_id`. RLS policies restrict access to members of that workspace. The server uses the Supabase service role only after validating the signed-in user and workspace; the service-role key must never be exposed to the browser.

## 2. Environment variables

Copy `.env.example` to your deployment environment.

Generate the encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the result in `OUTCOM_TOKEN_ENCRYPTION_KEY`.

Required public variables:

```env
NEXT_PUBLIC_APP_URL=https://your-domain
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=...
OUTCOM_TOKEN_ENCRYPTION_KEY=64_HEX_CHARS
OUTCOM_CRON_SECRET=...
```

## 3. Deploy the web application

Recommended preview stack:

- Next.js on Vercel
- Supabase Auth + PostgreSQL
- Cloudflare Worker for scheduled observation

Vercel is the straightforward Next.js deployment target. For a design-partner preview, Vercel Hobby is convenient; check the current plan terms before using it for a commercial paid service. A paid production tier should be used once Outcom is charging clients.

## 4. OAuth providers

### HighLevel

Configure a HighLevel OAuth app with the callback:

```text
https://YOUR-DOMAIN/api/oauth/ghl/callback
```

The public connection uses OAuth 2.0 and requests read-only contact/location scopes. A design-partner PIT fallback remains available on the Connect page.

### Make

Configure the Make OAuth client with:

```text
https://YOUR-DOMAIN/api/oauth/make/callback
```

The observer requests read scopes only. Make's `GET /scenarios?teamId=` endpoint requires `scenarios:read`; the API's read scopes do not permit write operations. The manual design-partner path asks for a numeric Team ID and a token with `scenarios:read`.

### Zapier

Outcom uses Zapier's Powered by Zapier / Workflow API OAuth flow. The intended scopes are:

```text
profile zap:all
```

Zapier's current User Access Token documentation states that this flow requires a published public integration before Client ID/Secret and redirect-URI configuration are available. Do not fake an integration, test account or endpoint to pass review. If Outcom moves to Zapier White Label embedded workflows, follow Zapier's partner onboarding path instead.

### n8n

n8n does not use a universal third-party OAuth login for arbitrary customer instances. The connection UI therefore uses:

```text
n8n instance URL + API key
```

Outcom reads workflow definitions and execution history using the native API and does not add an HTTP Request node to the customer's workflow.

## 5. Groq Operator

The user does **not** need to edit server `.env` to give Operator an AI key.

After signing in:

```text
Settings
  → Operator
  → Bring your own Groq key
  → paste gsk_...
  → Verify & save
```

The API key is verified server-side against Groq, encrypted with AES-256-GCM and stored in `workspace_settings.groq_api_key_encrypted`.

Operator uses the workspace key only from the server. The browser never receives the key.

The default model is:

```text
openai/gpt-oss-120b
```

Groq currently documents Structured Outputs for `openai/gpt-oss-120b` and `openai/gpt-oss-20b`, including strict JSON-schema output. V25 uses strict structured output for Operator navigation decisions.

## 6. Scheduled observer

The repository contains a Cloudflare Worker under `observer/`.

It calls:

```text
POST /api/cron/observe
Authorization: Bearer $OUTCOM_CRON_SECRET
```

The included Wrangler config schedules the worker every five minutes. The route iterates workspaces and runs native n8n monitors with the correct workspace context.

The architecture is intentionally designed so Make/Zapier observers can be added without putting a monitoring node inside the customer automation.

## 7. Security boundaries

- Authentication: Supabase Auth.
- Authorization: workspace membership + RLS.
- Provider credentials: encrypted at rest at the application layer.
- Service role key: server only.
- OAuth state: workspace-bound and short-lived.
- Operator API key: workspace-bound and encrypted.
- Provider actions: read-only by default.
- Observer: external to customer workflow.
- AI: safe navigation only; no integration mutation from chat.

## Product boundary

Outcom is not another execution monitor.

The product asks:

> **Did the automation produce the business outcome it was supposed to produce?**

It does this through:

1. workflow discovery
2. execution observation
3. entity correlation
4. downstream verification
5. historical state memory
6. regression detection
7. evidence-backed findings

Inference is conservative. If Outcom cannot establish a deterministic business outcome, it should report **UNKNOWN**, not invent a contract.

## Design-partner demo target

The product should be able to show a real agency:

```text
Connect automation platform
        ↓
Discover workflow
        ↓
Protect one workflow
        ↓
Observe successful execution
        ↓
Read actual downstream business state
        ↓
PASS / FAIL / UNKNOWN
        ↓
Evidence graph
```

That is the core proof required before positioning Outcom at the $500–$1,000/month agency tier.

## V59 real integrations

V59 turns the Connect page into working provider paths instead of placeholder connection copy:

- **n8n:** native REST API connection, workflow discovery, workflow protection, and execution sync. n8n documents API-key authentication through `X-N8N-API-KEY`; API availability depends on the n8n plan. 
- **HighLevel:** read-only Private Integration Token connection for a specific Location, with OAuth available for public deployments.
- **Make:** native API-token connection/discovery when API access is available, plus an outbound HTTP webhook bridge that does not require Outcom to receive a Make webhook.
- **Zapier:** OAuth discovery when Outcom has Zapier credentials configured, plus a webhook-first path that creates a private Outcom POST URL for a specific Zap.

### Inbound webhook contract

Zapier and Make can send a final JSON POST to the generated Outcom URL. The URL token is the credential. The recommended payload is:

```json
{
  "execution_id": "unique-run-id",
  "timestamp": "2026-09-25T00:00:00.000Z",
  "status": "success",
  "target_record_id": "highlevel-contact-id",
  "data": {
    "target_record_id": "highlevel-contact-id"
  }
}
```

Outcom deduplicates by execution ID, records the execution event, and runs the configured Outcome Contract against the downstream HighLevel state. Test requests use `{ "test": true }` and do not create an execution finding.
