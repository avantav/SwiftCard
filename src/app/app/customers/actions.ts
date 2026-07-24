"use server";

import { redirect } from "next/navigation";
import { requireInternalArea } from "@/lib/auth/server";
import { validateEmployeeCustomerRegistration } from "@/lib/customers/employee-registration";

function back(params: Record<string, string>): never {
  redirect(`/app/customers?${new URLSearchParams(params).toString()}`);
}

export async function updateCustomer(formData: FormData) {
  const customerId = formData.get("customerId");
  if (typeof customerId !== "string" || !customerId) back({ error: "Cliente inválido." });
  const context = await requireInternalArea("APP");
  if (context.access.role !== "ADMIN" && context.access.role !== "MANAGER") {
    back({ error: "No tienes permiso para editar clientes." });
  }
  const validation = validateEmployeeCustomerRegistration(formData);
  if (!validation.ok) back({ error: validation.errors.join(" ") });

  const { data, error } = await context.supabase.rpc("update_customer_profile", {
    target_customer_id: customerId,
    target_full_name: validation.data.fullName,
    target_normalized_phone: validation.data.phone,
    target_email: validation.data.email ?? "",
    target_birth_date: validation.data.birthDate,
    target_status: formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE"
  });
  if (error || data === "DUPLICATE") back({ error: "Ese teléfono ya está registrado." });
  if (data !== "UPDATED") back({ error: "No tienes acceso a ese cliente." });
  back({ updated: "1" });
}
