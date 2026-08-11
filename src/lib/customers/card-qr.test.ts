import { describe, expect, it } from "vitest";
import { createCustomerCardQrDataUrl } from "./card-qr";

const token = "AbcdefghijKLMNOPqrstuvwxyz0123456789-_ABCDE";

describe("customer card QR", () => {
  it("generates a bounded PNG from the opaque public token", async () => {
    const dataUrl = await createCustomerCardQrDataUrl(token);
    const png = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(dataUrl).not.toContain(token);
  });

  it("rejects values that are not valid public card tokens", async () => {
    await expect(createCustomerCardQrDataUrl("short-token")).rejects.toThrow(
      "Invalid customer card token.",
    );
  });
});
