import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  appleDeviceIdentifierHash,
  applePassAuthenticationToken,
  applePassAuthorizationMatches,
  applePushTokenHash,
  encryptApplePushToken,
} from "./apple-update-crypto";
import { getAppleWalletUpdateSecret } from "./apple-server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._~-]+$/;
const PUSH_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;

export function configuredApplePassTypeIdentifier() {
  return process.env.APPLE_PASS_TYPE_ID?.trim() ?? "";
}

export function validApplePassTypeIdentifier(value: string) {
  const configured = configuredApplePassTypeIdentifier();
  return Boolean(configured && value === configured);
}

export function validAppleSerialNumber(value: string) {
  return value.length <= 64 && UUID_PATTERN.test(value);
}

export function validAppleDeviceIdentifier(value: string) {
  return (
    value.length >= 1 &&
    value.length <= 256 &&
    DEVICE_IDENTIFIER_PATTERN.test(value)
  );
}

export function validApplePushToken(value: string) {
  return value.length >= 1 && value.length <= 1024 && PUSH_TOKEN_PATTERN.test(value);
}

export function parseAppleUpdateTag(value: string | null) {
  if (value === null || value === "") return null;
  if (!/^[0-9]{1,19}$/.test(value)) return undefined;
  const parsed = BigInt(value);
  if (parsed > BigInt("9223372036854775807")) return undefined;
  return parsed.toString();
}

export async function getAppleWalletPassRecord(serialNumber: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("wallet_passes")
    .select(
      "id,serial_number,status,update_tag,update_pending_at,last_synced_at,updated_at",
    )
    .eq("provider", "APPLE")
    .eq("serial_number", serialNumber)
    .maybeSingle();
  if (error || !data || data.status === "REVOKED") return null;
  return data;
}

export function applePassRequestIsAuthorized(
  serialNumber: string,
  authorizationHeader: string | null,
) {
  const secret = getAppleWalletUpdateSecret();
  return applePassAuthorizationMatches(
    authorizationHeader,
    applePassAuthenticationToken(secret, serialNumber),
  );
}

export async function registerAppleWalletDevice(input: {
  serialNumber: string;
  deviceLibraryIdentifier: string;
  pushToken: string;
}) {
  const secret = getAppleWalletUpdateSecret();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.schema("app").rpc(
    "register_apple_wallet_device",
    {
      target_serial_number: input.serialNumber,
      target_device_library_hash: appleDeviceIdentifierHash(
        secret,
        input.deviceLibraryIdentifier,
      ),
      target_push_token_hash: applePushTokenHash(secret, input.pushToken),
      target_push_token_ciphertext: encryptApplePushToken(secret, input.pushToken),
    },
  );
  if (error) throw error;
  return data as "CREATED" | "UPDATED" | "INVALID" | "NOT_FOUND";
}

export async function unregisterAppleWalletDevice(input: {
  serialNumber: string;
  deviceLibraryIdentifier: string;
}) {
  const secret = getAppleWalletUpdateSecret();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.schema("app").rpc(
    "unregister_apple_wallet_device",
    {
      target_serial_number: input.serialNumber,
      target_device_library_hash: appleDeviceIdentifierHash(
        secret,
        input.deviceLibraryIdentifier,
      ),
    },
  );
  if (error) throw error;
  return data as "DELETED" | "NOT_FOUND";
}

export async function listAppleWalletUpdates(input: {
  deviceLibraryIdentifier: string;
  previousUpdateTag: string | null;
}) {
  const secret = getAppleWalletUpdateSecret();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.schema("app").rpc(
    "list_apple_wallet_updates",
    {
      target_device_library_hash: appleDeviceIdentifierHash(
        secret,
        input.deviceLibraryIdentifier,
      ),
      target_previous_update_tag: input.previousUpdateTag,
    },
  );
  if (error) throw error;
  return (data ?? []) as Array<{ serial_number: string; update_tag: string }>;
}

export function sanitizeAppleWalletLog(value: string) {
  return value
    .replace(/ApplePass\s+\S+/gi, "ApplePass [REDACTED]")
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/\/devices\/[^/\s]+/gi, "/devices/[REDACTED]")
    .replace(/\/passes\/[^/\s]+\/[^/\s]+/gi, "/passes/[REDACTED]")
    .replace(/\/card\/[^/\s]+/gi, "/card/[REDACTED]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/\+?\d[\d\s()-]{8,}\d/g, "[PHONE]")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[IDENTIFIER]")
    .replace(/[A-Za-z0-9_-]{80,}/g, "[TOKEN]")
    .slice(0, 1000);
}
