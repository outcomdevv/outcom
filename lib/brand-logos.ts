// Real company logos for the tool and app cards. Nothing here is drawn or invented:
//  1. a logo that exists in a public icon library is loaded from it (Iconify serves the logos project and Simple Icons);
//  2. otherwise the card looks for an official logo file that the team puts in /public/brands/<id>.svg or .png;
//  3. only if neither exists does the card show a plain grey badge with the name's initials.
export type LogoSource = { prefix: "logos" | "simple-icons"; name: string; color?: string };

export const LOGO_SOURCES: Record<string, LogoSource> = {
  // automation platforms
  pipedream: { prefix: "logos", name: "pipedream" },
  power_automate: { prefix: "simple-icons", name: "powerautomate", color: "0066FF" },
  uipath: { prefix: "simple-icons", name: "uipath", color: "FA4616" },
  airtable_automations: { prefix: "logos", name: "airtable" },
  // destination apps
  salesforce: { prefix: "logos", name: "salesforce" },
  pipedrive: { prefix: "logos", name: "pipedrive" },
  intercom: { prefix: "logos", name: "intercom" },
  notion: { prefix: "logos", name: "notion-icon" },
  coda: { prefix: "logos", name: "coda-icon" },
  postgres: { prefix: "logos", name: "postgresql" },
  mongodb: { prefix: "logos", name: "mongodb-icon" },
  google_drive: { prefix: "logos", name: "google-drive" },
  dropbox: { prefix: "logos", name: "dropbox" },
  slack: { prefix: "logos", name: "slack-icon" },
  teams: { prefix: "logos", name: "microsoft-teams" },
  stripe: { prefix: "logos", name: "stripe" },
};

/** Tools with no logo in any public library. Put the company's official file at public/brands/<id>.svg (or .png). */
export const NEEDS_OFFICIAL_LOGO = ["lindy", "vellum"] as const;

const ICONIFY = "https://api.iconify.design";

/** Where to try loading a logo from, in order. */
export function logoChain(id: string): string[] {
  const s = LOGO_SOURCES[id];
  const local = [`/brands/${id}.svg`, `/brands/${id}.png`];
  if (!s) return local;
  return [`${ICONIFY}/${s.prefix}/${s.name}.svg${s.color ? `?color=%23${s.color}` : ""}`, ...local];
}

export const initials = (label: string) => label.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
