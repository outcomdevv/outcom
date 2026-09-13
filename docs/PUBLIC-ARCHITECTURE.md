# Outcom Public Architecture

## Product boundary

Outcom is an external business-outcome observer. It does not require a monitoring HTTP node inside a customer's workflow.

## Request path

```text
Browser
  ↓
Next.js / Vercel
  ↓
Supabase Auth
  ↓
Workspace authorization
  ↓
Supabase Postgres
```

Provider secrets never cross into client-side React code.

## Workspace isolation

Every business table has `workspace_id`.

A signed-in user maps to `workspace_members`.

The server validates the user's membership before reading/writing workspace data. RLS is also enabled on exposed tables as defense in depth.

## Credentials

Provider OAuth tokens, n8n API keys, Make tokens, HighLevel PITs and workspace Groq keys are encrypted with AES-256-GCM before storage.

The encryption key is an application secret and never stored in Postgres.

## Observer

The web application is not responsible for keeping a Node process alive.

Cloudflare Worker Cron calls the authenticated observer endpoint every five minutes. The endpoint loads workspaces from Supabase and executes provider-specific observers with explicit workspace context.

## Evidence model

```text
provider execution
      ↓
entity correlation
      ↓
downstream read
      ↓
outcome contract
      ↓
PASS / FAIL / UNKNOWN
      ↓
evidence-backed incident
```

## AI boundary

Operator can reason over workspace context and navigate. It cannot mutate integrations, contracts or protected workflows from chat.

Workspace users can supply their own Groq key from Settings. The key is encrypted and only used server-side.
