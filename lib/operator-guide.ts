// What Operator knows about Outcom itself. Kept short and factual: it is sent with every question,
// and Operator is told to rely on it, so anything wrong here becomes a wrong answer.
export const OPERATOR_GUIDE = `
ABOUT OUTCOM
Outcom checks whether an automation really produced the business result, not just whether it ran. Many automations show "success" while the record they should have created is missing (a silent failure). Outcom is read-only: it never changes the customer's automations or business data.

VERDICTS
- PASS: the expected result was found.
- FAIL: the automation succeeded but the expected result is missing or wrong. This opens a finding.
- UNKNOWN: Outcom could not decide (no evidence arrived, or a connection failed).

HOW A WORKFLOW GETS PROTECTED
1. "Connect stack" (top right) opens a short wizard: pick the platform (n8n, Zapier, Make or other), pick the checks, pick where Outcom looks.
2. The last step of the automation sends a small message (POST) to a secret webhook address Outcom gives. Each message is one run.
3. Outcom then checks each expectation (an "outcome contract") and records PASS, FAIL or UNKNOWN with evidence.

WHERE THE AUTOMATION RUNS
- n8n, Zapier, Make, any tool that can send an HTTP POST. The "Another tool?" list adds Pipedream, Activepieces, Power Automate, Workato, UiPath, Airtable Automations, HighLevel Workflows, and the AI agent builders Gumloop, Relevance AI, Lindy, Stack AI and Vellum. None of the extra tools has been tested live yet; they all use the same POST.

WHERE OUTCOM LOOKS
- Google Sheets, Airtable, HubSpot (contacts only) and HighLevel: Outcom reads the system itself (independent verification).
- Any other app: "Any other app" (pick which one: Salesforce, Pipedrive, Intercom, Notion, Coda, Supabase/PostgreSQL/MySQL, MongoDB, Google Drive, Dropbox, Slack, Microsoft Teams, Stripe, or another). There is no direct connector for these. The automation adds a read-back step that looks the record up and reports what it found. Outcom judges that report. The evidence is labelled "reported by the workflow, not independently verified". Several steps can report into the same run (same run_id).
- AI agents: each workflow also has an MCP address (shown under "Using an AI agent instead?" in the Any other app guide). The agent calls the tool verify_outcome after a task, reporting what it read back, and gets PASS, FAIL or UNKNOWN. It is still reported evidence, not independent.
- Fields whose name looks secret (password, token, api key, card number...) are stored as "[redacted]".
- Make can also be read from an exported blueprint; n8n workflows can be read from an exported workflow. Zapier needs the paid Webhooks by Zapier step.

SILENT FAILURES THAT LEAVE NO FAILED RUN (V95)
- Watches (on a workflow's page): "No runs arrived for a while" catches a trigger or schedule that stopped; "Volume dropped" catches fewer runs or outputs than usual; "Counts do not match another workflow" compares two streams. Outcom's scheduler checks them about every 5 minutes. A new watch needs one full period before it judges. The finding closes itself when things recover.
- Per-run checks beyond the basics: "fields filled in" (several fields at once), "number of records" (exactly one catches duplicates; needs Any other app, the workflow sends count), "written within N minutes" (a date field close to the run time), and a value compared with a field the run itself carried (for example the email typed in the form must equal the email in the CRM).
- Connect, step 2 has starter templates: new lead, lead has a real owner, invoice or payment, email or SMS sent, booking.

CHECK TYPES
- Record exists: the record the run handled can be found.
- Value check: a named column or property has an expected value.
- Run produced output: the run reported at least one output.

PAGES
- Overview: counts of protected workflows, healthy ones and open findings, plus the latest findings.
- Workflows: every protected workflow. Opening one shows its checks, recent runs (Verified or Finding), and its webhook address, which can be replaced there.
- Findings: Open, Resolved and All. Opening one shows expected vs observed, the evidence and the recommended action. "Mark as resolved" closes it. If the same check fails again, a new finding opens.
- Reports: Reliability (how often results were correct, trend, weakest workflows), Evidence (the proof chain behind each finding) and Proof report (a client-ready summary for the last 7, 30 or 90 days: runs checked, results verified, silent failures caught, what is still open). A Proof report can be shared by a private link that shows counts, workflow names and finding titles only, never record values. The link can be revoked.
- Connect, step 2: "Not sure what to check?" lets the user describe the workflow; Operator suggests checks and the user adds the ones they want. Nothing is created without the user adding it.
- Settings: workspace name, the optional Groq key for Operator, and a security summary.

LIMITS TO STATE HONESTLY
- Outcom does not repair anything or re-run automations.
- HubSpot checks cover contacts only. Each workflow has checks against the places chosen for it.
- A webhook address is a secret: whoever has it can send events to that workflow, but cannot read data.
`.trim();
