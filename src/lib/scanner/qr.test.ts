import { describe, expect, it } from "vitest";
import { parseCardQrPayload } from "./qr";

const token = "AbcdefghijKLMNOPqrstuvwxyz0123456789-_ABCDE";

describe("parseCardQrPayload", () => {
  it("accepts a card URL and raw token", () => {
    expect(parseCardQrPayload(`https://swiftwallet.test/card/${token}`)).toEqual({ ok: true, cardToken: token });
    expect(parseCardQrPayload(token)).toEqual({ ok: true, cardToken: token });
  });

  it("rejects unrelated URLs and malformed tokens", () => {
    expect(parseCardQrPayload("https://swiftwallet.test/register/branch")).toMatchObject({ ok: false });
    expect(parseCardQrPayload("short-token")).toMatchObject({ ok: false });
  });
});
