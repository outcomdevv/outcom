import { describe, it, expect, vi } from "vitest";
import { listZaps, normalizeZap, safeZapierNext, ZapierApiError } from "@/lib/zapier";

const zap = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Zap ${id}`, is_enabled: true, steps: [{}, {}], links: { html_editor: `https://zapier.com/editor/${id}` }, ...extra });
const page = (data: unknown[], next: string | null, count: number) => ({ data, links: { next }, meta: { count } });
const res = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const next = (offset: number) => `https://api.zapier.com/v2/zaps?limit=2&offset=${offset}`;

describe("normalizeZap", () => {
  it("maps documented fields", () => {
    expect(normalizeZap(zap("a", { updated_at: "2026-01-01T00:00:00Z", last_successful_run_date: null }))).toEqual({
      id: "a", name: "Zap a", enabled: true, updatedAt: "2026-01-01T00:00:00Z", url: "https://zapier.com/editor/a", platform: "zapier", lastSuccessfulRun: null, steps: 2,
    });
  });
  it("handles sparse/odd input", () => {
    expect(normalizeZap(null)).toBeNull();
    expect(normalizeZap({ title: "no id" })).toBeNull();
    const z = normalizeZap({ id: 5, title: "  " })!;
    expect(z).toMatchObject({ id: "5", name: "Untitled Zap", enabled: true, url: null, steps: null });
    expect(normalizeZap({ id: "x", is_enabled: false })!.enabled).toBe(false);
  });
});

describe("safeZapierNext", () => {
  it("only follows api.zapier.com links", () => {
    expect(safeZapierNext("https://api.zapier.com/v2/zaps?offset=10")).toContain("offset=10");
    expect(safeZapierNext("/v2/zaps?offset=10")).toBe("https://api.zapier.com/v2/zaps?offset=10");
    expect(safeZapierNext("https://evil.example/v2/zaps")).toBeNull();
    expect(safeZapierNext("http://api.zapier.com/v2/zaps")).toBeNull();
    expect(safeZapierNext(null)).toBeNull();
  });
});

describe("listZaps", () => {
  it("follows pagination across all pages, sends bearer token, dedupes", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(page([zap("1"), zap("2")], next(2), 5)))
      .mockResolvedValueOnce(res(page([zap("2"), zap("3")], next(4), 5)))
      .mockResolvedValueOnce(res(page([zap("4"), zap("5")], null, 5)));
    const r = await listZaps("tok", { fetchImpl: f as any });
    expect(r.items.map(i => i.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(r).toMatchObject({ total: 5, pages: 3, partial: false, warning: null });
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
    expect(f.mock.calls[0][0]).toContain("/v2/zaps?limit=10&offset=0");
  });

  it("requests include_shared only when asked", async () => {
    const f = vi.fn().mockResolvedValue(res(page([], null, 0)));
    await listZaps("t", { fetchImpl: f as any, includeShared: true });
    expect(f.mock.calls[0][0]).toContain("include_shared=true");
  });

  it("empty account is a valid, complete result", async () => {
    const r = await listZaps("t", { fetchImpl: (async () => res(page([], null, 0))) as any });
    expect(r).toMatchObject({ items: [], total: 0, partial: false });
  });

  it("tolerates missing data/meta/links", async () => {
    const r = await listZaps("t", { fetchImpl: (async () => res({})) as any });
    expect(r).toMatchObject({ items: [], total: 0, pages: 1, partial: false });
  });

  it("does not follow a next link to another host", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(page([zap("1")], "https://evil.example/steal", 1)));
    const r = await listZaps("t", { fetchImpl: f as any });
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.items).toHaveLength(1);
  });

  it("stops on a looping next link", async () => {
    const f = vi.fn().mockImplementation(async () => res(page([zap("1")], "https://api.zapier.com/v2/zaps?limit=10&offset=0", 1)));
    const r = await listZaps("t", { fetchImpl: f as any });
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.items).toHaveLength(1);
  });

  it("returns partial results when a later page fails", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(page([zap("1"), zap("2")], next(2), 4))).mockResolvedValueOnce(res({ errors: [] }, 500));
    const r = await listZaps("t", { fetchImpl: f as any });
    expect(r.items).toHaveLength(2);
    expect(r.partial).toBe(true);
    expect(r.warning).toMatch(/failed mid-listing/);
  });

  it("flags a count mismatch as partial", async () => {
    const r = await listZaps("t", { fetchImpl: (async () => res(page([zap("1")], null, 3))) as any });
    expect(r.partial).toBe(true);
    expect(r.warning).toMatch(/reported 3/);
  });

  it("flags hitting the page cap", async () => {
    const f = vi.fn().mockImplementation(async (url: string) => { const o = Number(new URL(url).searchParams.get("offset")); return res(page([zap(String(o + 1))], next(o + 1), 99)); });
    const r = await listZaps("t", { fetchImpl: f as any, maxPages: 3 });
    expect(r.pages).toBe(3);
    expect(r.partial).toBe(true);
  });

  it.each([[401, "reauth_required"], [403, "forbidden"], [409, "forbidden"], [429, "rate_limited"], [500, "upstream"]])("first-page %i throws %s", async (status, kind) => {
    await expect(listZaps("t", { fetchImpl: (async () => res({ detail: "nope" }, status)) as any, maxRetries: 0 })).rejects.toMatchObject({ kind, status });
  });

  it("throws on an unreadable first page", async () => {
    await expect(listZaps("t", { fetchImpl: (async () => new Response("<html>", { status: 200 })) as any })).rejects.toBeInstanceOf(ZapierApiError);
  });

  it("retries a short 429 using Retry-After then succeeds", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const f = vi.fn().mockResolvedValueOnce(res({}, 429, { "retry-after": "2" })).mockResolvedValueOnce(res(page([zap("1")], null, 1)));
    const r = await listZaps("t", { fetchImpl: f as any, sleep });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(r.items).toHaveLength(1);
  });

  it("does not wait on a long Retry-After", async () => {
    const sleep = vi.fn();
    const f = vi.fn().mockResolvedValue(res({}, 429, { "retry-after": "3600" }));
    await expect(listZaps("t", { fetchImpl: f as any, sleep })).rejects.toMatchObject({ kind: "rate_limited", retryAfterSeconds: 3600 });
    expect(sleep).not.toHaveBeenCalled();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
