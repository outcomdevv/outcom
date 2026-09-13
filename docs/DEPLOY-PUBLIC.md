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
