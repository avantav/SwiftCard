export const PIN_SESSION_COOKIE = "swiftwallet-pin-session";
export const PIN_SESSION_HEADER = "x-swiftwallet-operator-session";

export const pinSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/app"
};

export function isSixDigitPin(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}
