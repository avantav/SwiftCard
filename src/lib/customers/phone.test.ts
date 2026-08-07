import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["811 111 1111", "+528111111111"],
    ["(81) 1111-1111", "+528111111111"],
    ["+52 81 1111 1111", "+528111111111"],
    ["0052 81 1111 1111", "+528111111111"],
    ["+5218111111111", "+528111111111"],
    ["+1 (415) 555-2671", "+14155552671"]
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["", "abc 8111111111", "+52", "12345", "+0 8111111111"])(
    "rejects %s",
    (input) => {
      expect(normalizePhone(input).ok).toBe(false);
    }
  );
});
