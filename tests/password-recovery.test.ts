import { describe, it, expect, vi, beforeEach } from "vitest";
import { passwordProblem } from "@/lib/password";

const { resetPasswordForEmail } = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { resetPasswordForEmail } })) }));
const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ auth: { verifyOtp } })) }));
import { POST } from "@/app/api/auth/forgot/route";
import { GET as confirm } from "@/app/auth/confirm/route";
import { NextRequest } from "next/server";

const call = (body: unknown) => POST(new Request("https://outcom-six.vercel.app/api/auth/forgot", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk";
  resetPasswordForEmail.mockReset(); verifyOtp.mockReset();
});

describe("passwordProblem", () => {
  it("needs 8 characters and a matching repeat", () => {
    expect(passwordProblem("short", "short")).toMatch(/at least 8/);
    expect(passwordProblem("longenough1", "different1")).toMatch(/do not match/);
    expect(passwordProblem("longenough1", "longenough1")).toBeNull();
  });
});

describe("POST /api/auth/forgot", () => {
  it("rejects a bad email without calling Supabase", async () => {
    expect((await call({ email: "nope" })).status).toBe(400);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("sends the link back to this site's reset page and gives the same answer for any address", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const r = await call({ email: " Someone@Example.com " });
    expect(r.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("someone@example.com", { redirectTo: "https://outcom-six.vercel.app/auth/reset" });
    expect((await r.json()).message).toMatch(/If an account exists/);
  });
  it("tells the user to wait when Supabase rate-limits, and hides other errors", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: { status: 429, message: "email rate limit exceeded" } });
    expect((await call({ email: "a@b.co" })).status).toBe(429);
    resetPasswordForEmail.mockResolvedValueOnce({ error: { status: 500, message: "SMTP exploded: secret detail" } });
    const r = await call({ email: "a@b.co" });
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toMatch(/SMTP|secret/);
  });
});

describe("GET /auth/confirm", () => {
  const go = (qs: string) => confirm(new NextRequest(`https://outcom-six.vercel.app/auth/confirm?${qs}`));
  it("sends a verified recovery link on to the reset page", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const r = await go("token_hash=h&type=recovery&next=/auth/reset");
    expect(r.headers.get("location")).toBe("https://outcom-six.vercel.app/auth/reset");
  });
  it("never redirects to another site", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    for (const next of ["https://evil.example/x", "//evil.example", "/\\evil.example"]) {
      const r = await go(`token_hash=h&type=recovery&next=${encodeURIComponent(next)}`);
      expect(new URL(r.headers.get("location")!).origin).toBe("https://outcom-six.vercel.app");
    }
  });
});
