import LegalPage, { H, LEGAL_CONTACT } from "@/app/legal-page";

export const metadata = { title: "Terms of Service — Outcom" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" intro="By using Outcom you agree to these terms. They are short on purpose.">
      <H>The service</H>
      <p>Outcom verifies whether automations produced the business result they reported, and shows the result as PASS, FAIL or UNKNOWN with evidence. It reads data from the tools you connect. It does not change your data.</p>
      <H>Your account</H>
      <p>You are responsible for your account and for the tools you connect. Only connect accounts you are allowed to connect, and keep your sign-in details private.</p>
      <H>Acceptable use</H>
      <p>Do not use Outcom to break the law, to access data you have no right to access, to attack or overload the service, or to resell it without agreement.</p>
      <H>Your data</H>
      <p>Your data stays yours. You give Outcom permission to read it only to run the checks you set up. See the <a href="/privacy">Privacy Policy</a> for details.</p>
      <H>No guarantee of results</H>
      <p>Outcom does its best to report accurately, but a check can be UNKNOWN when a connected tool is unreachable or does not give an answer. Outcom is a monitoring aid. It does not replace your own controls, and the service is provided as is, without warranties. To the extent the law allows, Outcom is not liable for losses that come from a missed or incorrect check.</p>
      <H>Ending use</H>
      <p>You can stop using Outcom and disconnect your tools at any time. Outcom may suspend accounts that break these terms.</p>
      <H>Changes</H>
      <p>If these terms change in a meaningful way, the date at the top will change. Continuing to use Outcom means you accept the new terms.</p>
      <H>Contact</H>
      <p><a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a></p>
    </LegalPage>
  );
}
