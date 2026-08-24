import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSixDigitPin, PIN_SESSION_COOKIE, PIN_SESSION_HEADER } from "./pin-session";

const migration = readFileSync(
  new URL("../../../supabase/migrations/0035_branch_roles_and_pin_access.sql", import.meta.url),
  "utf8"
);
const serverClient = readFileSync(new URL("../supabase/server.ts", import.meta.url), "utf8");
const unlockAction = readFileSync(new URL("../../app/app/unlock/actions.ts", import.meta.url), "utf8");
const unlockPage = readFileSync(new URL("../../app/app/unlock/page.tsx", import.meta.url), "utf8");
const pinPad = readFileSync(new URL("../../components/pin-pad-login.tsx", import.meta.url), "utf8");
const pinSessionSource = readFileSync(new URL("./pin-session.ts", import.meta.url), "utf8");

describe("branch PIN access", () => {
  it("accepts exactly six numeric digits", () => {
    expect(isSixDigitPin("123456")).toBe(true);
    expect(isSixDigitPin("12345")).toBe(false);
    expect(isSixDigitPin("12345a")).toBe(false);
  });

  it("keeps the operator token in a server-only cookie and request header", () => {
    expect(PIN_SESSION_COOKIE).toBe("swiftwallet-pin-session");
    expect(PIN_SESSION_HEADER).toBe("x-swiftwallet-operator-session");
    expect(serverClient).toContain("operatorSession");
    expect(pinSessionSource).toContain("httpOnly: true");
    expect(unlockAction).not.toContain("localStorage");
  });

  it("confirms the cookie before a full navigation and uses a six-digit PIN pad", () => {
    expect(unlockAction).toContain('status: "SUCCESS"');
    expect(unlockAction).not.toContain('redirect("/app")');
    expect(unlockPage).toContain("<PinPadLogin");
    expect(unlockPage).not.toContain('name="pin" type="password"');
    expect(pinPad).toContain('window.location.replace("/app")');
    expect(pinPad).toContain('name="pin" type="hidden"');
    expect(pinPad).toContain("PIN_LENGTH = 6");
    expect(pinPad).not.toContain("localStorage");
  });

  it("enforces mode, lockout, hashing, revocation and actor attribution in PostgreSQL", () => {
    expect(migration).toContain("SHARED_ACCOUNT_PIN");
    expect(migration).toContain("failed_pin_attempts");
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("extensions.crypt");
    expect(migration).toContain("extensions.digest");
    expect(migration).toContain("actor_pin_operator_id");
    expect(migration).toContain("current_staff_can_access_branch");
  });
});
