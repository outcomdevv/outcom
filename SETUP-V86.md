# V86 setup (Vercel env vars)
Production env vars, pasted straight into Vercel (never into chat):
- AIRTABLE_CLIENT_ID, AIRTABLE_CLIENT_SECRET
- HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET (only after HubSpot app is registered)
Redirect URLs: https://outcom-six.vercel.app/api/oauth/airtable/callback and .../hubspot/callback
After saving env vars, redeploy (push of V86 does it).
