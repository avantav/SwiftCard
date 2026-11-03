import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./config", () => ({ getRequiredPublicSupabaseConfig: () => ({ url: "https://supabase.example.com", anonKey: "public-anonymous-key" }) }));
vi.mock("next/headers", () => ({ cookies: () => { throw new Error("Must not read the current staff session"); } }));
import { createSupabasePublicServerClient } from "./public-server";

afterEach(() => vi.unstubAllGlobals());
describe("isolated public registration client", () => {
  it("uses only the anonymous key and sends no staff cookies or operator context", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify([{ result: "CREATED" }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchSpy);
    const client = createSupabasePublicServerClient();
    const result = await client.schema("app").rpc("register_public_customer", { target_branch_token: "public-branch" });
    expect(result.error).toBeNull();
    const [request, options] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(request).toContain("/rest/v1/rpc/register_public_customer");
    const headers = new Headers(options.headers);
    expect(headers.get("authorization")).toBe("Bearer public-anonymous-key");
    expect(headers.get("apikey")).toBe("public-anonymous-key");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-swiftwallet-pin-session")).toBe(false);
  });
});
