import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { clearServiceAccountTokenCache, getServiceAccountToken, loadServiceAccount, signServiceAccountJwt, ServiceAccountError } from "@/lib/google-service-account";
import { parseSheetTarget } from "@/lib/google-sheets";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const keyFile = { client_email: "robot@outcom.iam.gserviceaccount.com", private_key: privateKey };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

beforeEach(() => clearServiceAccountTokenCache());

describe("loadServiceAccount", () => {
  it("reads raw JSON, base64 JSON and escaped newlines; rejects junk", () => {
    expect(loadServiceAccount(JSON.stringify(keyFile))?.email).toBe(keyFile.client_email);
    expect(loadServiceAccount(Buffer.from(JSON.stringify(keyFile)).toString("base64"))?.email).toBe(keyFile.client_email);
    expect(loadServiceAccount(JSON.stringify({ ...keyFile, private_key: privateKey.replace(/\n/g, "\\n") }))?.privateKey).toBe(privateKey);
    expect(loadServiceAccount("")).toBeNull();
    expect(loadServiceAccount("not json")).toBeNull();
    expect(loadServiceAccount(JSON.stringify({ client_email: "a@b" }))).toBeNull();
  });
});

describe("signServiceAccountJwt", () => {
  it("produces a verifiable RS256 JWT with the read-only scope", () => {
    const jwt = signServiceAccountJwt({ email: keyFile.client_email, privateKey }, 1000);
    const [h, c, s] = jwt.split(".");
    expect(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({ iss: keyFile.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", iat: 1000, exp: 4600 });
  });
});

describe("getServiceAccountToken", () => {
  const sa = { email: keyFile.client_email, privateKey };
  it("exchanges the assertion and caches the token until near expiry", async () => {
    const f = vi.fn(async () => json({ access_token: "tok1", expires_in: 3600 }));
    let now = 0;
    expect(await getServiceAccountToken({ sa, fetchImpl: f as any, now: () => now })).toBe("tok1");
    now = 30 * 60_000;
    expect(await getServiceAccountToken({ sa, fetchImpl: f as any, now: () => now })).toBe("tok1");
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as any)[1].body)).toContain("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer");
    now = 3600_000;
    await getServiceAccountToken({ sa, fetchImpl: f as any, now: () => now });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("reports not_configured, rejected and upstream without leaking the key", async () => {
    await expect(getServiceAccountToken({ sa: null })).rejects.toMatchObject({ kind: "not_configured" });
    await expect(getServiceAccountToken({ sa, fetchImpl: (async () => json({ error: "invalid_grant" }, 400)) as any })).rejects.toMatchObject({ kind: "rejected" });
    await expect(getServiceAccountToken({ sa, fetchImpl: (async () => json({}, 503)) as any })).rejects.toMatchObject({ kind: "upstream" });
    await expect(getServiceAccountToken({ sa, fetchImpl: (async () => { throw new Error("net"); }) as any })).rejects.toBeInstanceOf(ServiceAccountError);
    await expect(getServiceAccountToken({ sa: { email: "x@y", privateKey: "bad" }, fetchImpl: (async () => json({})) as any })).rejects.toMatchObject({ kind: "rejected" });
  });
});

describe("sheet target access", () => {
  it("keeps a valid access mode and drops unknown ones", () => {
    const base = { spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz", sheetName: "Leads", keyColumn: "Email" };
    expect(parseSheetTarget({ ...base, access: "service_account" })?.access).toBe("service_account");
    expect(parseSheetTarget({ ...base, access: "evil" })?.access).toBeUndefined();
  });
});
