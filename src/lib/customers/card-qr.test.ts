import { describe, expect, it } from "vitest";
import { createCustomerCardClaimQrDataUrl, createCustomerCardQrDataUrl, customerCardClaimUrl } from "./card-qr";

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

  it("creates an absolute customer handoff URL and QR from the current device origin", async () => {
    expect(customerCardClaimUrl("http://192.168.1.6:3000", token)).toBe(
      `http://192.168.1.6:3000/card/${token}?claim=1`,
    );
    const dataUrl = await createCustomerCardClaimQrDataUrl("http://192.168.1.6:3000", token);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(() => customerCardClaimUrl("javascript:alert(1)", token)).toThrow("Invalid card claim origin.");
  });
});
