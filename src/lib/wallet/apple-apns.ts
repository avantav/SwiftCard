import "server-only";

import { connect, constants, type ClientHttp2Session } from "node:http2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptApplePushToken } from "./apple-update-crypto";
import {
  getAppleSigningConfig,
  getAppleWalletUpdateSecret,
} from "./apple-server";
import { walletProviderConfig } from "./service";
import {
  classifyAppleApnsResponse,
  type AppleApnsResult as ApnsResult,
} from "./apple-apns-result";

const APNS_ORIGIN = "https://api.push.apple.com";
const APNS_TIMEOUT_MS = 8_000;
type ClaimedUpdate = {
  outbox_id: string;
  wallet_pass_id: string;
  serial_number: string;
  update_tag: string;
  attempt_count: number;
  claim_token: string;
};

type PushTarget = {
  device_id: string;
  push_token_ciphertext: string;
};

function parseApnsReason(body: string) {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as { reason?: unknown };
    return typeof parsed.reason === "string" ? parsed.reason.slice(0, 100) : "";
  } catch {
    return "Malformed APNs response";
  }
}

function sendAppleWalletPush(pushToken: string): Promise<ApnsResult> {
  const signing = getAppleSigningConfig();

  return new Promise((resolve) => {
    let session: ClientHttp2Session | null = null;
    let settled = false;
    const finish = (result: ApnsResult) => {
      if (settled) return;
      settled = true;
      session?.close();
      resolve(result);
    };

    try {
      session = connect(APNS_ORIGIN, {
        cert: Buffer.concat([
          signing.certificates.signerCert,
          Buffer.from("\n", "utf8"),
          signing.certificates.wwdr,
        ]),
        key: signing.certificates.signerKey,
        passphrase: signing.certificates.signerKeyPassphrase,
        minVersion: "TLSv1.2",
      });
      session.setTimeout(APNS_TIMEOUT_MS, () => {
        session?.destroy();
        finish({
          delivered: false,
          invalidToken: false,
          status: null,
          reason: "APNs connection timed out",
        });
      });
      session.once("error", (error) => {
        finish({
          delivered: false,
          invalidToken: false,
          status: null,
          reason: error instanceof Error ? error.message.slice(0, 100) : "APNs connection failed",
        });
      });

      const payload = "{}";
      const request = session.request({
        [constants.HTTP2_HEADER_METHOD]: "POST",
        [constants.HTTP2_HEADER_PATH]: `/3/device/${pushToken}`,
        "apns-topic": signing.identity.passTypeIdentifier,
        "apns-push-type": "background",
        "apns-priority": "5",
        "apns-expiration": "0",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
      });
      let responseStatus = 0;
      let responseBody = "";
      request.setEncoding("utf8");
      request.on("response", (headers) => {
        responseStatus = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0);
      });
      request.on("data", (chunk: string) => {
        if (responseBody.length < 4096) responseBody += chunk;
      });
      request.once("end", () => {
        finish(classifyAppleApnsResponse(responseStatus, parseApnsReason(responseBody)));
      });
      request.once("error", (error) => {
        finish({
          delivered: false,
          invalidToken: false,
          status: null,
          reason: error instanceof Error ? error.message.slice(0, 100) : "APNs request failed",
        });
      });
      request.end(payload);
    } catch (error) {
      session?.destroy();
      finish({
        delivered: false,
        invalidToken: false,
        status: null,
        reason: error instanceof Error ? error.message.slice(0, 100) : "APNs request failed",
      });
    }
  });
}

function retryDelaySeconds(attemptCount: number) {
  return Math.min(3600, 30 * 2 ** Math.min(Math.max(attemptCount - 1, 0), 7));
}

type DispatchOptions = {
  limit?: number;
  tenantId?: string;
  customerId?: string;
};

export async function dispatchPendingAppleWalletUpdates(
  options: DispatchOptions = {},
) {
  if (!walletProviderConfig("APPLE").configured) {
    return { claimed: 0, completed: 0, deferred: 0, delivered: 0, invalidated: 0 };
  }

  const supabase = createSupabaseAdminClient();
  const limit = options.limit ?? 10;
  const { data: claimedData, error: claimError } = await supabase
    .schema("app")
    .rpc("claim_apple_wallet_updates", {
      target_limit: Math.min(Math.max(limit, 1), 50),
      target_lease_seconds: 30,
      target_tenant_id: options.tenantId ?? null,
      target_customer_id: options.customerId ?? null,
    });
  if (claimError) throw claimError;
  const claimed = (claimedData ?? []) as ClaimedUpdate[];
  const secret = getAppleWalletUpdateSecret();
  let completed = 0;
  let deferred = 0;
  let delivered = 0;
  let invalidated = 0;

  for (const update of claimed) {
    let failureReason = "";
    try {
      const { data: targetData, error: targetError } = await supabase
        .schema("app")
        .rpc("get_apple_wallet_push_targets", {
          target_wallet_pass_id: update.wallet_pass_id,
          target_update_tag: update.update_tag,
        });
      if (targetError) throw targetError;
      const targets = (targetData ?? []) as PushTarget[];

      for (const target of targets) {
        let result: ApnsResult;
        try {
          const pushToken = decryptApplePushToken(
            secret,
            target.push_token_ciphertext,
          );
          result = await sendAppleWalletPush(pushToken);
        } catch (error) {
          result = {
            delivered: false,
            invalidToken: false,
            status: null,
            reason:
              error instanceof Error
                ? error.message.slice(0, 100)
                : "Push token decryption failed",
          };
        }

        if (result.delivered) {
          const { error } = await supabase.schema("app").rpc(
            "record_apple_wallet_push_success",
            {
              target_wallet_pass_id: update.wallet_pass_id,
              target_device_id: target.device_id,
              target_update_tag: update.update_tag,
            },
          );
          if (error) throw error;
          delivered += 1;
          continue;
        }
        if (result.invalidToken) {
          const { error } = await supabase
            .schema("app")
            .rpc("invalidate_apple_wallet_device", {
              target_device_id: target.device_id,
            });
          if (error) throw error;
          invalidated += 1;
          continue;
        }
        failureReason = `${result.status ?? "NETWORK"}: ${result.reason}`.slice(0, 500);
      }
    } catch (error) {
      failureReason = (
        error instanceof Error ? error.message : "Apple Wallet dispatch failed"
      ).slice(0, 500);
    }

    if (failureReason) {
      const { error } = await supabase.schema("app").rpc(
        "retry_apple_wallet_update",
        {
          target_outbox_id: update.outbox_id,
          target_claim_token: update.claim_token,
          target_error: failureReason,
          target_delay_seconds: retryDelaySeconds(update.attempt_count),
        },
      );
      if (error) throw error;
      deferred += 1;
    } else {
      const { error } = await supabase.schema("app").rpc(
        "complete_apple_wallet_update",
        {
          target_outbox_id: update.outbox_id,
          target_claim_token: update.claim_token,
        },
      );
      if (error) throw error;
      completed += 1;
    }
  }

  return {
    claimed: claimed.length,
    completed,
    deferred,
    delivered,
    invalidated,
  };
}

export async function dispatchAppleWalletUpdatesBestEffort(
  options: DispatchOptions = {},
) {
  try {
    return await dispatchPendingAppleWalletUpdates(options);
  } catch (error) {
    console.error("[apple-wallet-update-dispatch]", {
      message: error instanceof Error ? error.message.slice(0, 200) : "Unknown dispatch error",
    });
    return { claimed: 0, completed: 0, deferred: 0, delivered: 0, invalidated: 0 };
  }
}
