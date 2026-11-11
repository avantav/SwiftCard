import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { addGoogleWalletMessage } from "./google-server";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const serviceAccount = JSON.stringify({
  client_email: "wallet@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("addGoogleWalletMessage", () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  let addMessageResponses: Response[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv("GOOGLE_WALLET_SERVICE_ACCOUNT", serviceAccount);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com")) {
        return jsonResponse(200, { access_token: "token", expires_in: 3600 });
      }
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return addMessageResponses.shift() ?? jsonResponse(500, {});
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const message = { id: "purchase-p1", header: "Compra registrada", body: "Ahora tienes 4 sellos." };

  it("sends a notifying message to the loyalty object", async () => {
    addMessageResponses = [jsonResponse(200, {})];
    await expect(addGoogleWalletMessage("issuer.object", message)).resolves.toBe("NOTIFIED");
    const sent = calls.filter((call) => call.url.includes("/addMessage"));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toContain("/loyaltyObject/issuer.object/addMessage");
    expect(sent[0]?.body).toEqual({ message: { ...message, messageType: "TEXT_AND_NOTIFY" } });
  });

  it("stores the message without a notification once the daily quota is exhausted", async () => {
    addMessageResponses = [
      jsonResponse(429, { error: { message: "QuotaExceededException" } }),
      jsonResponse(200, {}),
    ];
    await expect(addGoogleWalletMessage("issuer.object", message)).resolves.toBe(
      "SAVED_WITHOUT_NOTIFICATION",
    );
    const types = calls
      .filter((call) => call.url.includes("/addMessage"))
      .map((call) => (call.body as { message: { messageType: string } }).message.messageType);
    expect(types).toEqual(["TEXT_AND_NOTIFY", "TEXT"]);
  });

  it("treats an existing message id as already delivered", async () => {
    addMessageResponses = [jsonResponse(409, {})];
    await expect(addGoogleWalletMessage("issuer.object", message)).resolves.toBe("ALREADY_SENT");
  });

  it("surfaces other provider failures to the best-effort caller", async () => {
    addMessageResponses = [jsonResponse(500, {})];
    await expect(addGoogleWalletMessage("issuer.object", message)).rejects.toThrow(
      "Google Wallet addMessage failed (500).",
    );
  });
});

describe("Wallet activity delivery boundary", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("routes every purchase and redemption through the combined dispatcher", () => {
    const purchase = read("../../app/app/purchase/actions.ts");
    const redeem = read("../../app/app/redeem/actions.ts");
    const scan = read("../../app/app/scan/actions.ts");
    expect(purchase).toContain("dispatchWalletActivityBestEffort");
    expect(redeem).toContain("dispatchWalletActivityBestEffort");
    expect(scan.match(/dispatchWalletActivityBestEffort\(/g)).toHaveLength(2);
  });

  it("refreshes Google objects without the generic field-update notice", () => {
    const activity = read("./google-activity.ts");
    expect(activity).toContain('import "server-only"');
    expect(activity).toContain("notifyOnUpdate: false");
    expect(activity).toContain("addGoogleWalletMessage");
    expect(activity).not.toMatch(/console\.error\([^)]*(phone|email|full_name)/);
  });
});
