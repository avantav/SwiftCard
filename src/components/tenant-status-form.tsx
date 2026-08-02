"use client";

import { useFormStatus } from "react-dom";
import { setTenantStatus } from "@/app/superadmin/tenants/actions";

function StatusButton({ status }: { status: "ACTIVE" | "SUSPENDED" }) {
  const { pending } = useFormStatus();
  const suspending = status === "ACTIVE";

  return (
    <button
      className={suspending ? "enterprise-menu-action is-destructive" : "enterprise-menu-action"}
      disabled={pending}
      type="submit"
    >
      {pending ? "Actualizando…" : suspending ? "Suspender tenant" : "Reactivar tenant"}
    </button>
  );
}

export function TenantStatusForm({ tenantId, status, tenantName }: { tenantId: string; status: "ACTIVE" | "SUSPENDED"; tenantName: string }) {
  const suspending = status === "ACTIVE";

  return (
    <form
      action={setTenantStatus}
      onSubmit={(event) => {
        const action = suspending ? "suspender" : "reactivar";
        if (!window.confirm(`¿Deseas ${action} ${tenantName}?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="status" value={suspending ? "SUSPENDED" : "ACTIVE"} />
      <StatusButton status={status} />
    </form>
  );
}
