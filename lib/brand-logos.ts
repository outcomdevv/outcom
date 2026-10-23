// Logos for the tools and apps shown as cards. Each is a Simple Icons slug; when a slug does not exist the card
// shows a coloured initials badge instead, so a missing logo never leaves a broken image.
export type Brand = { slug: string | null; color: string };

export const BRANDS: Record<string, Brand> = {
  // automation platforms
  pipedream: { slug: "pipedream", color: "34D399" },
  activepieces: { slug: "activepieces", color: "6E41E2" },
  power_automate: { slug: "powerautomate", color: "0066FF" },
  workato: { slug: null, color: "FF6D00" },
  uipath: { slug: "uipath", color: "FA4616" },
  airtable_automations: { slug: "airtable", color: "18BFFF" },
  gumloop: { slug: null, color: "F97316" },
  relevance_ai: { slug: null, color: "7C3AED" },
  lindy: { slug: null, color: "2563EB" },
  stack_ai: { slug: null, color: "0F766E" },
  vellum: { slug: null, color: "111827" },
  // destination apps
  salesforce: { slug: "salesforce", color: "00A1E0" },
  pipedrive: { slug: "pipedrive", color: "111827" },
  intercom: { slug: "intercom", color: "6AFDEF" },
  notion: { slug: "notion", color: "000000" },
  coda: { slug: "coda", color: "F46A54" },
  postgres: { slug: "postgresql", color: "4169E1" },
  mongodb: { slug: "mongodb", color: "47A248" },
  google_drive: { slug: "googledrive", color: "4285F4" },
  dropbox: { slug: "dropbox", color: "0061FF" },
  slack: { slug: "slack", color: "4A154B" },
  teams: { slug: "microsoftteams", color: "6264A7" },
  stripe: { slug: "stripe", color: "635BFF" },
};

export const brandUrl = (id: string): string | null => {
  const b = BRANDS[id];
  return b?.slug ? `https://cdn.simpleicons.org/${b.slug}/${b.color}` : null;
};
export const brandColor = (id: string) => `#${BRANDS[id]?.color ?? "6B7280"}`;
export const initials = (label: string) => label.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
