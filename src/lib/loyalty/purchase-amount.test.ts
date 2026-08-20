import { describe, expect, it } from "vitest";
import { formatPurchaseAmount, parsePurchaseAmount, purchaseAmountInputStep } from "./purchase-amount";

describe("employee purchase amounts", () => {
  it("converts a readable currency amount into authoritative minor units", () => {
    expect(parsePurchaseAmount("125.50", "MXN")).toBe(12550);
    expect(parsePurchaseAmount("125.5", "USD")).toBe(12550);
    expect(parsePurchaseAmount("125", "JPY")).toBe(125);
    expect(formatPurchaseAmount(12550, "MXN")).toContain("125.50");
    expect(purchaseAmountInputStep("MXN")).toBe("0.01");
    expect(purchaseAmountInputStep("JPY")).toBe("1");
  });

  it("rejects invalid, excessive or non-positive amounts", () => {
    expect(parsePurchaseAmount("0", "MXN")).toBeNull();
    expect(parsePurchaseAmount("12.345", "MXN")).toBeNull();
    expect(parsePurchaseAmount("-2", "MXN")).toBeNull();
    expect(parsePurchaseAmount("not-money", "MXN")).toBeNull();
  });
});
