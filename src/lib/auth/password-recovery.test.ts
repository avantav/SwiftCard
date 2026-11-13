import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  afterTasks: [] as Array<() => Promise<void>>,
  rpc: vi.fn(),
  generateLink: vi.fn(),
  profile: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  sendEmail: vi.fn(),
  configured: true,
}));

class RedirectError extends Error {
  constructor(readonly location: string) { super(`redirect:${location}`); }
}

vi.mock("next/navigation", () => ({ redirect: (location: string) => { throw new RedirectError(location); } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => { mocks.afterTasks.push(task); } }));
vi.mock("@/lib/email/resend", () => ({
  emailConfig: () => ({ configured: mocks.configured }),
  sendEmail: mocks.sendEmail,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    schema: () => ({ rpc: mocks.rpc }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
    auth: { admin: { generateLink: mocks.generateLink } },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { verifyOtp: mocks.verifyOtp, updateUser: mocks.updateUser, signOut: mocks.signOut },
  }),
}));

import { completePasswordRecovery, requestPasswordRecovery } from "@/app/recuperar-contrasena/actions";
import { validateNewPasswordForm } from "./passwords";
import { clientAddress, isRecoveryToken, normalizeRecoveryEmail, recoveryLink, sha256Hex } from "./password-recovery";

const OWNER = "00000000-0000-0000-0000-000000000011";
const TOKEN = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

async function location(action: Promise<unknown>) {
  try {
    await action;
  } catch (error) {
    if (error instanceof RedirectError) return error.location;
    throw error;
  }
  throw new Error("Action did not redirect");
}

async function runAfterTasks() {
  for (const task of mocks.afterTasks.splice(0)) await task();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterTasks.length = 0;
  mocks.configured = true;
  process.env.SWIFTWALLET_PUBLIC_URL = "https://swiftycards.com";
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "request_owner_password_recovery" ? { data: OWNER, error: null } : { data: true, error: null });
  mocks.generateLink.mockResolvedValue({ data: { user: { id: OWNER }, properties: { hashed_token: TOKEN } }, error: null });
  mocks.profile.mockResolvedValue({ data: { full_name: "Ana Dueña", role: "ADMIN", status: "ACTIVE", tenants: { status: "ACTIVE" } } });
  mocks.verifyOtp.mockResolvedValue({ data: { user: { id: OWNER } }, error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "msg" });
});

describe("password recovery helpers", () => {
  it("normalizes emails and validates tokens", () => {
    expect(normalizeRecoveryEmail("  Ana@Example.COM ")).toBe("ana@example.com");
    expect(normalizeRecoveryEmail("not-an-email")).toBeNull();
    expect(normalizeRecoveryEmail(null)).toBeNull();
    expect(isRecoveryToken(TOKEN)).toBe(true);
    expect(isRecoveryToken("short")).toBe(false);
    expect(isRecoveryToken("<script>alert(1)</script>xxxxxxxxxxxx")).toBe(false);
  });

  it("hashes, reads the client address and builds the link", () => {
    expect(sha256Hex("a")).toMatch(/^[0-9a-f]{64}$/);
    expect(clientAddress(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientAddress(new Headers())).toBe("unknown");
    expect(recoveryLink("https://swiftycards.com", TOKEN)).toBe(`https://swiftycards.com/recuperar-contrasena/nueva?token=${TOKEN}`);
  });

  it("validates the new password without a current one", () => {
    expect(validateNewPasswordForm(form({ newPassword: "x".repeat(12), passwordConfirmation: "x".repeat(12) })).ok).toBe(true);
    expect(validateNewPasswordForm(form({ newPassword: "short", passwordConfirmation: "short" }))).toMatchObject({ ok: false });
    expect(validateNewPasswordForm(form({ newPassword: "x".repeat(12), passwordConfirmation: "y".repeat(12) }))).toMatchObject({ ok: false });
  });
});

describe("requestPasswordRecovery", () => {
  it("answers neutrally and emails eligible owners after the response", async () => {
    expect(await location(requestPasswordRecovery(form({ email: "Ana@Example.com" })))).toBe("/recuperar-contrasena?sent=1");
    expect(mocks.sendEmail).not.toHaveBeenCalled();

    await runAfterTasks();
    expect(mocks.rpc).toHaveBeenCalledWith("request_owner_password_recovery", {
      target_email: "ana@example.com",
      target_email_hash: sha256Hex("ana@example.com"),
      target_client_hash: sha256Hex("203.0.113.7"),
    });
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: "recovery", email: "ana@example.com" });
    const message = mocks.sendEmail.mock.calls[0]![0];
    expect(message).toMatchObject({ to: "ana@example.com", fromName: "morrow", subject: "Restablece tu contraseña de morrow" });
    expect(message.html).toContain(`https://swiftycards.com/recuperar-contrasena/nueva?token=${TOKEN}`);
    expect(message.html).toContain("Hola Ana,");
  });

  it("gives the same answer and sends nothing for ineligible or rate-limited emails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await location(requestPasswordRecovery(form({ email: "nadie@example.com" })))).toBe("/recuperar-contrasena?sent=1");
    await runAfterTasks();
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("rejects malformed emails before scheduling any work", async () => {
    expect(await location(requestPasswordRecovery(form({ email: "nope" })))).toBe("/recuperar-contrasena?error=invalid_email");
    expect(mocks.afterTasks).toHaveLength(0);
  });

  it("sends nothing when the generated link belongs to another user", async () => {
    mocks.generateLink.mockResolvedValue({ data: { user: { id: "someone-else" }, properties: { hashed_token: TOKEN } }, error: null });
    await location(requestPasswordRecovery(form({ email: "ana@example.com" })));
    await runAfterTasks();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("completePasswordRecovery", () => {
  const valid = { token: TOKEN, newPassword: "una-clave-segura", passwordConfirmation: "una-clave-segura" };

  it("sets the password, audits, closes other sessions and opens the admin area", async () => {
    expect(await location(completePasswordRecovery(form(valid)))).toBe("/admin");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN, type: "recovery" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "una-clave-segura" });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_owner_password_recovery", { target_user_id: OWNER });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("does not consume the token when the form is invalid", async () => {
    const result = await location(completePasswordRecovery(form({ ...valid, passwordConfirmation: "otra-clave-distinta" })));
    expect(result).toContain("/recuperar-contrasena/nueva?");
    expect(result).toContain(`token=${TOKEN}`);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects expired or reused links", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    expect(await location(completePasswordRecovery(form(valid)))).toBe("/recuperar-contrasena?error=invalid_link");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("never changes the password of a non-owner and drops the recovery session", async () => {
    mocks.profile.mockResolvedValue({ data: { role: "MANAGER", status: "ACTIVE", tenants: { status: "ACTIVE" } } });
    expect(await location(completePasswordRecovery(form(valid)))).toBe("/recuperar-contrasena?error=reset_failed");
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
