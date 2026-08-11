const INVALID_TOKEN_REASONS = new Set([
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "Unregistered",
]);

export type AppleApnsResult = {
  delivered: boolean;
  invalidToken: boolean;
  status: number | null;
  reason: string;
};

export function classifyAppleApnsResponse(
  status: number,
  reason: string,
): AppleApnsResult {
  return {
    delivered: status === 200,
    invalidToken: status === 410 || INVALID_TOKEN_REASONS.has(reason),
    status,
    reason: reason || (status === 200 ? "Delivered" : `APNs HTTP ${status}`),
  };
}
