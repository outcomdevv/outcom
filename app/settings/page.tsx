import { getWorkspaceStore } from "@/lib/db";
import { getUser, ensureWorkspace } from "@/lib/auth";
import OperatorSettings from "./operator-settings";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const store = await getWorkspaceStore();
  const settings = await store.settings.get();
  const user = await getUser();
  const workspace = await ensureWorkspace().catch(() => null);
  const configured = Boolean(settings.groqApiKeyEncrypted);

  return (
    <div className="settings-page">
      <div className="page-header-row">
        <div>
          <span className="section-kicker">SETTINGS</span>
          <h1 className="page-title">Settings</h1>
          <p className="page-intro">Your workspace, the optional Operator assistant, and how your data is protected.</p>
        </div>
      </div>

      <section className="settings-grid" style={{ gridTemplateColumns: "minmax(0, 860px)" }}>
        <div className="settings-main">
          <section className="settings-card">
            <div className="settings-card-head">
              <div>
                <span className="section-kicker">WORKSPACE</span>
                <h2>{workspace?.workspace?.name || "Outcom Workspace"}</h2>
                <p>Signed in as {user?.email ?? "unknown"}. Everything you protect in Outcom lives in this workspace.</p>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <div>
                <span className="section-kicker">OPERATOR (OPTIONAL)</span>
                <h2>Operator assistant</h2>
                <p>Operator is the “Ask Operator” button. It answers questions about your findings and needs your own Groq key. Without a key only Operator is switched off. Protecting workflows and checking outcomes keep working.</p>
              </div>
              <span className={configured ? "setting-status on" : "setting-status"}>{configured ? "CONFIGURED" : "NOT CONFIGURED"}</span>
            </div>
            <OperatorSettings configured={configured} model={settings.groqModel} />
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <div>
                <span className="section-kicker">DATA AND SECURITY</span>
                <h2>How your data is protected</h2>
              </div>
            </div>
            <ul className="settings-facts" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              <li>Outcom only reads. It never edits your automations or your business data.</li>
              <li>Connection tokens and keys are encrypted (AES-256-GCM) before they are stored, and are never shown again.</li>
              <li>Your workflows, checks and findings are stored in a database that separates each workspace.</li>
              <li>Webhook addresses are secret keys. You can replace one on a workflow’s page.</li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
