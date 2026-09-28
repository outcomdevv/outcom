# V74 — Outcome Contracts + Business System Foundation

V74 moves Outcom from a HighLevel-shaped protection UI toward a provider-neutral business-system layer.

## Product surface

- `/contracts` — plain-language Outcome Contract builder.
- `/records` — minimal native Outcom Records source of truth.
- `/api/contracts` — creates workspace-scoped contracts.
- `/api/records` — creates and reads native records.
- Google Sheets OAuth provider and read-only adapter foundation.

## Business-system model

The verifier now supports:

- `outcom_records` → existing workspace contacts table.
- `google_sheets` → configured spreadsheet/sheet/lookup column.
- `ghl` → existing HighLevel adapter.

The verification engine remains the same: execution → lookup → downstream evidence → PASS/FAIL/UNKNOWN.

## Google setup

V74 adds the Google OAuth connection path but does not ship Google Cloud credentials. Set:

- `GOOGLE_SHEETS_CLIENT_ID`
- `GOOGLE_SHEETS_CLIENT_SECRET`
- `GOOGLE_SHEETS_REDIRECT_URI`

The default OAuth scope is `https://www.googleapis.com/auth/drive.file`, intentionally narrower than full Drive access. Google recommends per-file access and the Picker for this model. See the official Google Drive/Sheets OAuth and Picker documentation before publishing the app.

After Google is connected, the `/contracts` page can list spreadsheets that the token can see, load sheet tabs, and store the selected spreadsheet/sheet/lookup column in the workspace connection metadata.

## Important MVP boundary

Outcom Records is not intended to become a CRM. It exists so a user with no CRM/system of record can still demonstrate and verify an outcome.
