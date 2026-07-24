import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns the service health payload", async () => {
    const response = GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      service: "swiftwallet",
      version: "0.1.0"
    });
  });
});

