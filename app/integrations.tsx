export type IntegrationName = "n8n" | "zapier" | "make" | "ghl" | "custom";

const logoUrl = (name: IntegrationName) => ({
  n8n: "https://cdn.simpleicons.org/n8n/EA4B71",
  zapier: "https://cdn.simpleicons.org/zapier/FF4A00",
  make: "https://cdn.simpleicons.org/make/6D3CFF",
  // Official HighLevel brand asset from HighLevel's 2026 brand kit.
  ghl: "https://assets.cdn.filesafe.space/zELBHkVp0JPbbLvKIlF5/media/690a5f4a57ea175183408da2.png",
  custom: "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>'),
}[name]);

const label = (name: IntegrationName) => name === "ghl" ? "HighLevel" : name === "custom" ? "Other tool" : name;

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
