import LegalPage, { H, LEGAL_CONTACT } from "@/app/legal-page";

export const metadata = { title: "Privacy Policy — Outcom" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" intro="Outcom checks whether your automations really produced the business result they reported. This page explains what data Outcom touches to do that, and what it does not.">
      <H>What Outcom collects</H>
      <ul>
        <li><b>Account data:</b> your email address and workspace name, used to sign you in.</li>
        <li><b>Automation reports:</b> the small messages your automations send to Outcom (for example a record ID, a status, an execution ID).</li>
        <li><b>Check results:</b> PASS, FAIL or UNKNOWN for each check, with the evidence needed to explain it, such as which field was compared and what was found.</li>
        <li><b>Connection tokens:</b> when you connect Airtable, HubSpot, Google or another tool, Outcom stores the access token you authorized so it can run your checks.</li>
      </ul>
      <H>How Outcom uses your connected tools</H>
      <p>Outcom asks for <b>read-only</b> access. For Airtable that is <code>data.records:read</code> and <code>schema.bases:read</code>. For HubSpot that is <code>crm.objects.contacts.read</code>. Outcom looks up only the specific record an automation reported, to confirm that it exists or has the expected value. Outcom never creates, edits or deletes anything in your tools.</p>
      <H>Shared reports</H>
      <p>If you create a Proof report link, anyone who has the link can view a summary of counts, workflow names and finding titles for the period you chose. It never includes record values or evidence details. You can revoke the link at any time and it stops working immediately.</p>
      <H>How tokens are protected</H>
      <p>Access and refresh tokens are encrypted at rest and are never sent back to your browser. You can disconnect a tool at any time, and you can also revoke Outcom directly inside Airtable, HubSpot or Google.</p>
      <H>What Outcom does not do</H>
      <ul>
        <li>Outcom does not sell your data.</li>
        <li>Outcom does not use your data from connected tools for advertising.</li>
        <li>Outcom does not read records beyond the ones needed for your checks.</li>
      </ul>
      <H>Service providers</H>
      <p>Outcom runs on third-party infrastructure: Supabase (database and sign-in) and Vercel (hosting). If you use the Operator assistant, the text of your question and the relevant check context are sent to the AI provider used for it (Groq).</p>
      <H>Retention and deletion</H>
      <p>Your data stays while your workspace is active. To delete your workspace, connections and stored results, email <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a> and it will be removed.</p>
      <H>Changes</H>
      <p>If this policy changes in a meaningful way, the date at the top will change.</p>
    </LegalPage>
  );
}
