"use server";

import { withNotice } from "@/lib/forms/notices";
import { redirect } from "next/navigation";
import { canViewTenantCustomers } from "@/lib/auth/permissions";
import { requireInternalArea } from "@/lib/auth/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireGeneralAdmin() {
  const context = await requireInternalArea("ADMIN", { writable: true });
  if (!canViewTenantCustomers(context.access) || !context.tenantId) redirect("/admin");
  return context;
}

export async function setAdminCustomerStatus(
  customerId: string,
  targetStatus: "ACTIVE" | "INACTIVE",
) {
  const context = await requireGeneralAdmin();
  if (!UUID.test(customerId) || !["ACTIVE", "INACTIVE"].includes(targetStatus)) {
    redirect("/admin/customers?error=invalid");
  }
  const { data, error } = await context.supabase.schema("app").rpc(
    "set_admin_customer_status",
    { target_customer_id: customerId, target_status: targetStatus },
  );
  if (error || data !== "UPDATED") redirect("/admin/customers?error=status");
  redirect(withNotice("/admin/customers", targetStatus === "ACTIVE" ? "customer_activated" : "customer_deactivated"));
}

export async function deleteAdminCustomer(customerId: string) {
  const context = await requireGeneralAdmin();
  if (!UUID.test(customerId)) redirect("/admin/customers?error=invalid");
  const { data, error } = await context.supabase.schema("app").rpc(
    "delete_admin_customer",
    { target_customer_id: customerId },
  );
  if (error || data !== "DELETED") {
    redirect(`/admin/customers?error=${data === "HAS_HISTORY" ? "history" : "delete"}`);
  }
  redirect(withNotice("/admin/customers", "customer_deleted"));
}

/**
 * ARCO cancellation (DEC-0075): removes the customer's personal data, revokes
 * cards and Wallet passes and keeps the history without identifying data.
 */
export async function anonymizeAdminCustomer(customerId: string) {
  const context = await requireGeneralAdmin();
  if (!UUID.test(customerId)) redirect("/admin/customers?error=invalid");
  const { data, error } = await context.supabase.schema("app").rpc(
    "anonymize_admin_customer",
    { target_customer_id: customerId },
  );
  if (error || (data !== "ANONYMIZED" && data !== "ALREADY_ANONYMIZED")) {
    redirect("/admin/customers?error=anonymize");
  }
  redirect(withNotice("/admin/customers", "customer_anonymized"));
}
