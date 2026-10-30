export const SUPPORT_SESSION_COOKIE = "swiftwallet-support-session";

export const supportSessionCookieOptions = {
  httpOnly: true,
  maxAge: 60 * 60,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production"
};
