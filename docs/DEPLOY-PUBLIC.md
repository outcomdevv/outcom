# Deploy Outcom Public V25

## A. Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/migrations/001_public_architecture.sql`.
4. Copy the project URL and publishable key.
5. Copy the service-role key for Vercel **server-only** environment variables.

## B. GitHub

```powershell
git init
git add .
git commit -m "Outcom public V25"
git branch -M main
git remote add origin YOUR_GITHUB_REPO
git push -u origin main
```

Do not commit `.env.local` or any provider token.

## C. Vercel

1. Import the GitHub repository.
2. Add the variables from `.env.example`.
3. Set `NEXT_PUBLIC_APP_URL` to the Vercel domain.
4. Deploy.
5. Add the final production URL as the OAuth redirect base for each provider.

## D. Provider OAuth

### HighLevel

Set:

```text
https://YOUR-DOMAIN/api/oauth/ghl/callback
```

### Make

Set:

```text
https://YOUR-DOMAIN/api/oauth/make/callback
```

Make reviews OAuth client registrations. Until the client is approved, use the design-partner API-token fallback.

### Zapier

Set:

```text
https://YOUR-DOMAIN/api/oauth/zapier/callback
```

Zapier's current User Access Token flow requires a published public integration before its Client ID/Secret and redirect URI settings become available.

### n8n

No Outcom OAuth client is needed. A user connects their own n8n instance URL and read-only API key from the Connect page.

## E. Cloudflare observer

Install Wrangler and authenticate with Cloudflare.

From `observer/`:

```powershell
wrangler secret put OUTCOM_CRON_SECRET
wrangler deploy
```

Set `OUTCOM_APP_URL` in `observer/wrangler.toml` to the deployed Outcom URL.

The worker calls the protected observer endpoint every five minutes.

## F. First design-partner test

1. Open Outcom.
2. Create an account.
3. Connect HighLevel.
4. Connect n8n / Make / Zapier.
5. Discover a real automation.
6. Protect one workflow.
7. Run the workflow normally.
8. Wait for the observer.
9. Confirm the command center shows the observed business outcome.
10. Reproduce a known silent failure and capture the evidence chain.

The demo should prove the product's core value—not merely that the integrations connect.


## If Vercel shows `permission denied for table workspaces`

Run `supabase/migrations/002_service_role_privileges.sql` once in the **same Supabase project** used by Vercel, then redeploy. The server-side key must be configured in Vercel as `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`; never expose either key as a `NEXT_PUBLIC_*` variable.

## G. V59 real integration requirements

Run the new migration:

```text
supabase/migrations/003_real_integration_webhooks.sql
```

`NEXT_PUBLIC_APP_URL` must be the final production URL. V59 uses it for the private Zapier/Make inbound webhook URLs.

`OUTCOM_TOKEN_ENCRYPTION_KEY` must be present in Vercel because V59 encrypts provider credentials and webhook URL tokens at rest.

### Provider paths

- **n8n:** Settings → n8n API → create API key → paste instance URL + key into Outcom. The n8n API uses the `X-N8N-API-KEY` header.
- **HighLevel:** use a scoped Private Integration Token + Location ID for a design-partner/internal connection. Use OAuth for a public multi-client app.
- **Make:** use a Make API token with the required read scopes for native discovery, or use the Outcom webhook path and add an HTTP → Make a request module to the scenario.
- **Zapier:** use Outcom OAuth when the Zapier app credentials are configured, or use Webhooks by Zapier → POST with the private Outcom URL generated for the protected Zap.

Do not use Make's Custom webhook module for the Outcom inbound direction: that module receives data *into Make*. Outcom needs Make to send the scenario result *out to Outcom*, so use Make's HTTP request module instead.
