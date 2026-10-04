import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const store = { connections: { latest: vi.fn(), updateTokens: vi.fn() } };
vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn(async () => store) }));

import { buildAuthorizationUrl, callbackUrl, decryptSecret, encryptSecret, getValidAccessToken, isOAuthProvider, oauthConfigured, OAuthReauthRequired } from "@/lib/oauth";

const KEY = "a".repeat(64);
beforeEach(() => {
  process.env.OUTCOM_TOKEN_ENCRYPTION_KEY = KEY;
  process.env.ZAPIER_CLIENT_ID = "cid";
  process.env.ZAPIER_CLIENT_SECRET = "secret";
  process.env.APP_URL = "https://outcom.test";
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.ZAPIER_REDIRECT_URI;
  store.connections.latest.mockReset();
  store.connections.updateTokens.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const conn = (over: Record<string, unknown> = {}) => ({ id: "c1", accessToken: encryptSecret("old-access"), refreshToken: encryptSecret("old-refresh"), expiresAt: new Date(Date.now() + 3600_000).toISOString(), ...over });
const tokenRes = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("provider guard and config", () => {
  it("rejects prototype keys and unknown providers", () => {
    expect(isOAuthProvider("zapier")).toBe(true);
    for (const p of ["toString", "constructor", "__proto__", "nope"]) expect(isOAuthProvider(p)).toBe(false);
  });
  it("reports configured only with both id and secret", () => {
    expect(oauthConfigured("zapier")).toBe(true);
    delete process.env.ZAPIER_CLIENT_SECRET;
    expect(oauthConfigured("zapier")).toBe(false);
  });
  it("builds the Zapier authorization URL", () => {
    const u = new URL(buildAuthorizationUrl("zapier", "STATE123"));
    expect(u.origin + u.pathname).toBe("https://api.zapier.com/v2/authorize");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("client_id")).toBe("cid");
    expect(u.searchParams.get("state")).toBe("STATE123");
    expect(u.searchParams.get("redirect_uri")).toBe("https://outcom.test/api/oauth/zapier/callback");
    expect(u.searchParams.get("scope")).toContain("zap:account:all");
    expect(u.searchParams.get("scope")).not.toMatch(/write|delete|update|pause/);
  });
  it("honours an explicit redirect URI", () => {
    process.env.ZAPIER_REDIRECT_URI = "https://x.test/cb";
    expect(callbackUrl("zapier")).toBe("https://x.test/cb");
  });
});

describe("secret encryption", () => {
  it("round-trips and uses a random IV", () => {
    const a = encryptSecret("tok"), b = encryptSecret("tok");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("tok");
  });
  it("detects tampering", () => {
    const [iv, tag, data] = encryptSecret("tok").split(".");
    expect(() => decryptSecret(`${iv}.${tag}.${Buffer.from("xxx").toString("base64url")}`)).toThrow();
    expect(data).toBeTruthy();
  });
  it("rejects a bad key", () => {
    process.env.OUTCOM_TOKEN_ENCRYPTION_KEY = "short";
    expect(() => encryptSecret("x")).toThrow(/32 random bytes/);
  });
});

describe("getValidAccessToken", () => {
  it("returns null with no connection", async () => {
    store.connections.latest.mockResolvedValue(null);
    expect(await getValidAccessToken("zapier")).toBeNull();
  });
  it("returns the stored token when not near expiry, without calling the provider", async () => {
    store.connections.latest.mockResolvedValue(conn());
    const f = tokenRes({}); vi.stubGlobal("fetch", f);
    expect(await getValidAccessToken("zapier", "ws1")).toBe("old-access");
    expect(f).not.toHaveBeenCalled();
  });
  it("does not refresh on every call when no expiry is recorded", async () => {
    store.connections.latest.mockResolvedValue(conn({ expiresAt: null }));
    const f = tokenRes({}); vi.stubGlobal("fetch", f);
    expect(await getValidAccessToken("zapier")).toBe("old-access");
    expect(f).not.toHaveBeenCalled();
  });
  it("refreshes an expired token with Basic auth and persists rotated tokens (encrypted)", async () => {
    store.connections.latest.mockResolvedValue(conn({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    const f = tokenRes({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }); vi.stubGlobal("fetch", f);
    expect(await getValidAccessToken("zapier")).toBe("new-access");
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe("https://zapier.com/oauth/token/");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("cid:secret").toString("base64")}`);
    expect(String(init.body)).toContain("grant_type=refresh_token");
    const saved = store.connections.updateTokens.mock.calls[0][1];
    expect(saved.accessToken).not.toContain("new-access");
    expect(decryptSecret(saved.accessToken)).toBe("new-access");
    expect(decryptSecret(saved.refreshToken)).toBe("new-refresh");
    expect(new Date(saved.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
  it("keeps the old refresh token when the provider does not rotate it", async () => {
    const c = conn({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    store.connections.latest.mockResolvedValue(c);
    vi.stubGlobal("fetch", tokenRes({ access_token: "n", expires_in: 60 }));
    await getValidAccessToken("zapier");
    expect(store.connections.updateTokens.mock.calls[0][1].refreshToken).toBe(c.refreshToken);
  });
  it("forceRefresh refreshes even when the stored token looks valid", async () => {
    store.connections.latest.mockResolvedValue(conn());
    vi.stubGlobal("fetch", tokenRes({ access_token: "forced", expires_in: 60 }));
    expect(await getValidAccessToken("zapier", undefined, { forceRefresh: true })).toBe("forced");
  });
  it("forceRefresh without a refresh token returns null", async () => {
    store.connections.latest.mockResolvedValue(conn({ refreshToken: null }));
    expect(await getValidAccessToken("zapier", undefined, { forceRefresh: true })).toBeNull();
  });
  it("maps invalid_grant to OAuthReauthRequired", async () => {
    store.connections.latest.mockResolvedValue(conn({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    vi.stubGlobal("fetch", tokenRes({ error: "invalid_grant", error_description: "revoked" }, 400));
    await expect(getValidAccessToken("zapier")).rejects.toBeInstanceOf(OAuthReauthRequired);
    expect(store.connections.updateTokens).not.toHaveBeenCalled();
  });
  it("does not treat a provider outage as reauth", async () => {
    store.connections.latest.mockResolvedValue(conn({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    vi.stubGlobal("fetch", tokenRes({ error: "server_error" }, 503));
    const err = await getValidAccessToken("zapier").catch(e => e);
    expect(err).not.toBeInstanceOf(OAuthReauthRequired);
    expect(err.message).toContain("503");
  });
});
