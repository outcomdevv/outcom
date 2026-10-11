import { describe, expect, it } from "vitest";
import { HubspotAdapter, HubspotError, listContactProperties, parseHubspotTarget } from "@/lib/hubspot";

const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe("hubspot", () => {
  it("defaults to matching by email and keeps safe extra properties", () => {
    expect(parseHubspotTarget(undefined)).toEqual({ keyProperty: "email" });
    expect(parseHubspotTarget({ keyProperty: "Phone", properties: ["lifecyclestage", "bad name!"] })).toEqual({ keyProperty: "phone", properties: ["lifecyclestage"] });
  });
  it("searches by lower-cased email and returns the properties", async () => {
    let body: any;
    const a = new HubspotAdapter("t", { keyProperty: "email", properties: ["custom_score"] }, (async (_u: any, init: any) => { body = JSON.parse(init.body); return res(200, { results: [{ id: "51", properties: { email: "a@b.com", lifecyclestage: "lead" } }] }); }) as any, 0);
    expect(await a.getRecord("A@B.com")).toMatchObject({ id: "51", lifecyclestage: "lead" });
    expect(body.filterGroups[0].filters[0]).toEqual({ propertyName: "email", operator: "EQ", value: "a@b.com" });
    expect(body.properties).toContain("custom_score");
    expect(await a.getField("A@B.com", "LifecycleStage")).toBe("lead");
  });
  it("retries a 'not found' because search is indexed a moment late, then gives up", async () => {
    let calls = 0;
    const late = new HubspotAdapter("t", { keyProperty: "email" }, (async () => { calls++; return res(200, calls < 3 ? { results: [] } : { results: [{ id: "9", properties: { email: "a@b.com" } }] }); }) as any, 0, 2);
    expect(await late.getRecord("a@b.com")).toMatchObject({ id: "9" });
    expect(calls).toBe(3);
    let n = 0;
    const never = new HubspotAdapter("t", { keyProperty: "email" }, (async () => { n++; return res(200, { results: [] }); }) as any, 0, 2);
    expect(await never.getRecord("a@b.com")).toBeNull();
    expect(n).toBe(3);
  });
  it("can look a contact up by id", async () => {
    let url = "";
    const a = new HubspotAdapter("t", { keyProperty: "id" }, (async (u: any) => { url = String(u); return res(200, { id: "77", properties: { email: "x@y.com" } }); }) as any, 0);
    expect(await a.getRecord("77")).toMatchObject({ id: "77" });
    expect(url).toContain("/crm/v3/objects/contacts/77");
    expect(await new HubspotAdapter("t", { keyProperty: "id" }, (async () => res(404)) as any, 0, 0).getRecord("1")).toBeNull();
  });
  it("turns provider problems into clear errors (never a false 'missing')", async () => {
    for (const [status, kind] of [[401, "reauth_required"], [403, "forbidden"], [400, "bad_property"], [429, "rate_limited"], [502, "upstream"]] as const) {
      await expect(new HubspotAdapter("t", { keyProperty: "email" }, (async () => res(status)) as any, 0, 0).getRecord("a@b.com")).rejects.toMatchObject({ kind });
    }
    await expect(new HubspotAdapter("t", { keyProperty: "email" }, (async () => { throw new Error("net"); }) as any, 0, 0).getRecord("a@b.com")).rejects.toBeInstanceOf(HubspotError);
  });
  it("lists property names, falling back to common ones", async () => {
    expect(await listContactProperties("t", { fetchImpl: (async () => res(200, { results: [{ name: "email" }, { name: "age" }] })) as any })).toEqual(["age", "email"]);
    expect(await listContactProperties("t", { fetchImpl: (async () => res(403)) as any })).toContain("email");
  });
});
