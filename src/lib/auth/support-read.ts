import "server-only";

import type { requireInternalArea } from "@/lib/auth/server";

type Context = Awaited<ReturnType<typeof requireInternalArea>>;

/**
 * Read RPCs accept the support session token so a Superadmin in support mode
 * can see everything the tenant's Admin general sees (DEC-0071). Outside
 * support mode nothing is added.
 */
export function supportReadParams(context: Context): { target_support_token_hash?: string } {
  return context.supportSession && context.supportSessionTokenHash
    ? { target_support_token_hash: context.supportSessionTokenHash }
    : {};
}
