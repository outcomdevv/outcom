export type IntegrationName = "n8n" | "zapier" | "make" | "ghl";

const logoUrl = (name: IntegrationName) => ({
  n8n: "https://cdn.simpleicons.org/n8n/EA4B71",
  zapier: "https://cdn.simpleicons.org/zapier/FF4A00",
  make: "https://cdn.simpleicons.org/make/6D3CFF",
  // Official HighLevel brand asset from HighLevel's 2026 brand kit.
  ghl: "https://assets.cdn.filesafe.space/zELBHkVp0JPbbLvKIlF5/media/690a5f4a57ea175183408da2.png",
}[name]);

const label = (name: IntegrationName) => name === "ghl" ? "HighLevel" : name;

export function IntegrationLogo({ name, size = 38 }: { name: IntegrationName; size?: number }) {
  return (
    <img
      className={`integration-logo-image integration-logo-${name}`}
      src={logoUrl(name)}
      width={size}
      height={size}
      alt={`${label(name)} logo`}
      loading="eager"
      referrerPolicy="no-referrer"
    />
  );
}

export function IntegrationWordmark({ name }: { name: IntegrationName }) {
  return <span className={`integration-wordmark integration-${name}`}>{label(name)}</span>;
}
