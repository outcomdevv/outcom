// Zapier Workflow API discovery (read-only). Pure and dependency-injected so it can be unit-tested with mocked responses.
// Docs: GET https://api.zapier.com/v2/zaps — JSON:API style; pagination via links.next + meta.count.

export const ZAPIER_API_BASE = "https://api.zapier.com";
export const ZAPIER_ZAPS_PATH = "/v2/zaps";

export type ZapierErrorKind = "reauth_required" | "forbidden" | "rate_limited" | "upstream";

export class ZapierApiError extends Error {
  constructor(public kind: ZapierErrorKind, public status: number, message: string, public retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ZapierApiError";
  }
}

export type DiscoveredZap = {
  id: string;
  name: string;
  enabled: boolean;
  updatedAt: string | null;
  url: string | null;
  platform: "zapier";
  lastSuccessfulRun: string | null;
  steps: number | null;
};

export type ZapListResult = {
  items: DiscoveredZap[];
  /** Total reported by Zapier (meta.count) when available, otherwise number of items fetched. */
  total: number;
  pages: number;
  /** True when we stopped before the end (error mid-pagination or page cap). `items` is still valid but incomplete. */
  partial: boolean;
  /** Why the list is partial, safe to show to the user. */
  warning: string | null;
};

type Fetch = typeof fetch;

export type ListZapsOptions = {
  fetchImpl?: Fetch;
  /** Include Zaps shared with the user (needs the zap:account:all scope). */
  includeShared?: boolean;
  pageSize?: number;
  maxPages?: number;
  maxRetries?: number;
  /** Longest Retry-After (seconds) we are willing to wait inside a request. */
  maxRetryWaitSeconds?: number;
  sleep?: (ms: number) => Promise<void>;
};

export function normalizeZap(raw: any): DiscoveredZap | null {
  if (!raw || typeof raw !== "object" || raw.id == null || String(raw.id) === "") return null;
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Untitled Zap";
  return {
    id: String(raw.id),
    name: title,
    // Zapier documents is_enabled as defaulting to true; only treat an explicit false as paused.
    enabled: raw.is_enabled !== false,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
    url: typeof raw.links?.html_editor === "string" ? raw.links.html_editor : null,
    platform: "zapier",
    lastSuccessfulRun: typeof raw.last_successful_run_date === "string" ? raw.last_successful_run_date : null,
    steps: Array.isArray(raw.steps) ? raw.steps.length : null,
  };
}

/** Only follow pagination links that stay on api.zapier.com over https (never send the bearer token elsewhere). */
export function safeZapierNext(next: unknown): string | null {
  if (typeof next !== "string" || !next) return null;
  try {
    const url = new URL(next, ZAPIER_API_BASE);
    if (url.origin !== ZAPIER_API_BASE) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function classify(status: number, retryAfter: number | null): ZapierApiError {
  if (status === 401) return new ZapierApiError("reauth_required", 401, "Zapier rejected the stored access token. Reconnect Zapier.");
  if (status === 403 || status === 409) return new ZapierApiError("forbidden", status, "Zapier denied access. The connected account or OAuth scopes do not allow listing Zaps.");
  if (status === 429) return new ZapierApiError("rate_limited", 429, "Zapier rate limit reached. Try again shortly.", retryAfter);
  return new ZapierApiError("upstream", status, `Zapier returned HTTP ${status}.`);
}

async function fetchPage(url: string, token: string, o: Required<Pick<ListZapsOptions, "maxRetries" | "maxRetryWaitSeconds">> & { fetchImpl: Fetch; sleep: (ms: number) => Promise<void> }) {
  for (let attempt = 0; ; attempt++) {
    const r = await o.fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" }, cache: "no-store" });
    if (r.ok) {
      const body: any = await r.json().catch(() => null);
      if (!body || typeof body !== "object") throw new ZapierApiError("upstream", r.status, "Zapier returned an unreadable response.");
      return body;
    }
    const retryAfter = parseRetryAfter(r.headers?.get?.("retry-after") ?? null);
    const err = classify(r.status, retryAfter);
    if (err.kind === "rate_limited" && attempt < o.maxRetries && retryAfter != null && retryAfter <= o.maxRetryWaitSeconds) {
      await o.sleep(Math.max(retryAfter, 0.1) * 1000);
      continue;
    }
    throw err;
  }
}

/**
 * Lists every Zap the token can see. If the first page fails the error is thrown (caller decides: reauth, forbidden...).
 * If a later page fails we return what we have with partial=true so one bad page never hides pages already fetched.
 */
export async function listZaps(token: string, options: ListZapsOptions = {}): Promise<ZapListResult> {
  const o = {
    fetchImpl: options.fetchImpl ?? fetch,
    sleep: options.sleep ?? ((ms: number) => new Promise<void>(res => setTimeout(res, ms))),
    maxRetries: options.maxRetries ?? 2,
    maxRetryWaitSeconds: options.maxRetryWaitSeconds ?? 10,
  };
  const maxPages = options.maxPages ?? 200;
  const first = new URL(ZAPIER_ZAPS_PATH, ZAPIER_API_BASE);
  first.searchParams.set("limit", String(options.pageSize ?? 10));
  first.searchParams.set("offset", "0");
  if (options.includeShared) first.searchParams.set("include_shared", "true");

  const byId = new Map<string, DiscoveredZap>();
  const seenUrls = new Set<string>();
  let nextUrl: string | null = first.toString();
  let pages = 0;
  let total: number | null = null;
  let partial = false;
  let warning: string | null = null;

  while (nextUrl) {
    if (seenUrls.has(nextUrl)) break; // provider looped
    if (pages >= maxPages) { partial = true; warning = `Stopped after ${maxPages} pages; more Zaps may exist.`; break; }
    seenUrls.add(nextUrl);
    let body: any;
    try {
      body = await fetchPage(nextUrl, token, o);
    } catch (e) {
      if (pages === 0) throw e;
      partial = true;
      warning = e instanceof ZapierApiError && e.kind === "rate_limited" ? "Zapier rate limit hit mid-listing; showing the Zaps found so far." : "Zapier failed mid-listing; showing the Zaps found so far.";
      break;
    }
    const data: unknown[] = Array.isArray(body.data) ? body.data : [];
    for (const raw of data) {
      const zap = normalizeZap(raw);
      if (zap) byId.set(zap.id, zap);
    }
    const count = Number(body.meta?.count);
    if (body.meta?.count != null && Number.isFinite(count)) total = count;
    pages += 1;
    nextUrl = data.length === 0 ? null : safeZapierNext(body.links?.next);
  }

  const items = [...byId.values()];
  if (!partial && total != null && items.length < total) {
    partial = true;
    warning = `Zapier reported ${total} Zaps but only ${items.length} were returned.`;
  }
  return { items, total: total ?? items.length, pages, partial, warning };
}
