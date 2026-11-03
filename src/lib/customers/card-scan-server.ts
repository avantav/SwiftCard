import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getServerSupabaseServiceRoleKey } from "@/lib/supabase/config";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { isCustomerCardToken } from "./card-qr";

const PURPOSE = "morrow:public-card-scan:v1";

function scanKey() {
  const configured = process.env.CARD_SCAN_SECRET_BASE64?.trim();
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32 || key.toString("base64") !== configured) throw new Error("Invalid scan key configuration.");
    return key;
  }
  const serverKey = getServerSupabaseServiceRoleKey();
  if (!serverKey) throw new Error("Missing scan key configuration.");
  return createHash("sha256").update(`${PURPOSE}\0${serverKey}`).digest();
}

/** A printed QR never contains the private possession token in readable form. */
export function createPublicCardScanUrl(cardToken: string, origin: string) {
  const publicOrigin = resolvePublicOrigin(process.env.SWIFTWALLET_PUBLIC_URL || origin);
  if (!isCustomerCardToken(cardToken) || !publicOrigin) throw new Error("Invalid scan URL input.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scanKey(), iv);
  cipher.setAAD(Buffer.from(PURPOSE));
  const ciphertext = Buffer.concat([cipher.update(cardToken, "utf8"), cipher.final()]);
  const sealed = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  return `${publicOrigin}/scan/q1_${sealed}`;
}

/** This function is server-only; authentication is checked before staff resolution. */
export function openPublicCardScanToken(scanToken: string) {
  if (!/^q1_[A-Za-z0-9_-]{90,380}$/.test(scanToken)) return null;
  try {
    const sealed = Buffer.from(scanToken.slice(3), "base64url");
    if (sealed.toString("base64url") !== scanToken.slice(3)) return null;
    const decipher = createDecipheriv("aes-256-gcm", scanKey(), sealed.subarray(0, 12));
    decipher.setAAD(Buffer.from(PURPOSE));
    decipher.setAuthTag(sealed.subarray(12, 28));
    const token = Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString("utf8");
    return isCustomerCardToken(token) ? token : null;
  } catch { return null; }
}

/** Returns only a public registration path, never customer details or private tokens. */
export async function getCardRegistrationPath(cardToken: string): Promise<string | null> {
  if (!isCustomerCardToken(cardToken)) return null;
  try {
    const db = createSupabaseAdminClient();
    const { data: issued, error } = await db.from("customer_cards")
      .select("tenant_id,customer_id,loyalty_card_id").eq("public_token", cardToken).eq("status", "ACTIVE").maybeSingle();
    if (error || !issued?.loyalty_card_id) return null;
    const [customer, tenant, card] = await Promise.all([
      db.from("customers").select("source_branch_id").eq("id", issued.customer_id).eq("tenant_id", issued.tenant_id).eq("status", "ACTIVE").maybeSingle(),
      db.from("tenants").select("id").eq("id", issued.tenant_id).eq("status", "ACTIVE").maybeSingle(),
      db.from("loyalty_cards").select("id").eq("id", issued.loyalty_card_id).eq("tenant_id", issued.tenant_id).eq("status", "PUBLISHED").maybeSingle(),
    ]);
    if (customer.error || tenant.error || card.error || !customer.data || !tenant.data || !card.data) return null;
    const [branch, assignment] = await Promise.all([
      db.from("branches").select("public_registration_token").eq("id", customer.data.source_branch_id).eq("tenant_id", issued.tenant_id).eq("status", "ACTIVE").maybeSingle(),
      db.from("loyalty_card_branches").select("branch_id").eq("branch_id", customer.data.source_branch_id).eq("loyalty_card_id", issued.loyalty_card_id).maybeSingle(),
    ]);
    if (branch.error || assignment.error || !branch.data?.public_registration_token || !assignment.data) return null;
    return `/register/${encodeURIComponent(branch.data.public_registration_token)}?${new URLSearchParams({ card: issued.loyalty_card_id })}`;
  } catch { return null; }
}
