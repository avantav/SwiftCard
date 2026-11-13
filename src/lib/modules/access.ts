import "server-only";

import type { requireInternalArea } from "@/lib/auth/server";
import { supportReadParams } from "@/lib/auth/support-read";
import { getModuleEntry } from "./catalog";
import { createModuleChecker } from "./checker";

type Context = Awaited<ReturnType<typeof requireInternalArea>>;

const checker = createModuleChecker();

/**
 * Whether the caller's tenant (or the supported tenant in support mode) has a
 * module. Wrap only new code with it: when it returns false the previous
 * behavior must run. Any error evaluates as inactive (DEC-0072).
 */
export async function currentTenantHasModule(context: Context, key: string): Promise<boolean> {
  if (!getModuleEntry(key) || !context.tenantId) return false;
  return checker.check(`${context.tenantId}:${key}`, async () => {
    const { data, error } = await context.supabase
      .schema("app")
      .rpc("current_tenant_has_module", { target_key: key, ...supportReadParams(context) });
    if (error) throw error;
    return data === true;
  });
}
