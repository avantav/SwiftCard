import { describe, expect, it } from "vitest";
import { classifyAppleApnsResponse } from "./apple-apns-result";

describe("Apple Wallet APNs responses", () => {
  it("recognizes delivery and invalid device tokens", () => {
    expect(classifyAppleApnsResponse(200, "")).toMatchObject({
      delivered: true,
      invalidToken: false,
    });
    expect(classifyAppleApnsResponse(410, "Unregistered")).toMatchObject({
      delivered: false,
      invalidToken: true,
    });
    expect(classifyAppleApnsResponse(400, "DeviceTokenNotForTopic")).toMatchObject({
      invalidToken: true,
    });
  });

  it("keeps provider and network failures retryable", () => {
    expect(classifyAppleApnsResponse(403, "BadCertificate")).toMatchObject({
      delivered: false,
      invalidToken: false,
    });
    expect(classifyAppleApnsResponse(503, "ServiceUnavailable")).toMatchObject({
      delivered: false,
      invalidToken: false,
    });
  });
});
