import { describe, it, expect, vi } from "vitest";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn(async () => ({ incidents: { list } })) }));
import { GET } from "@/app/api/findings/count/route";

describe("GET /api/findings/count", () => {
  it("counts only open findings", async () => {
    list.mockResolvedValueOnce([{ status: "open" }, { status: "resolved" }, { status: "open" }]);
    const r = await GET();
    expect(await r.json()).toEqual({ open: 2 });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("answers 401 when there is no signed-in workspace", async () => {
    list.mockRejectedValueOnce(new Error("no session"));
    expect((await GET()).status).toBe(401);
  });
});
