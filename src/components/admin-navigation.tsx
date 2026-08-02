import { EnterpriseNavigation, type EnterpriseNavGroup } from "@/components/enterprise-navigation";

export function AdminNavigation({ email, role }: { email: string | null; role: "ADMIN" | "MANAGER" }) {
  const configuration = role === "ADMIN" ? [
    { href: "/admin/branches", label: "Sucursales", icon: "building" as const },
    { href: "/admin/staff", label: "Personal", icon: "users" as const },
    { href: "/admin/program", label: "Programa", icon: "award" as const }
  ] : [];
  const groups: EnterpriseNavGroup[] = [
    { label: "Operación", items: [
      { href: "/admin", label: "Vista general", icon: "home", exact: true },
      { href: "/admin/dashboard", label: "Dashboard", icon: "chart" }
    ] },
    ...(configuration.length ? [{ label: "Configuración", items: configuration }] : []),
    { label: "Datos", items: [{ href: "/admin/exports", label: "Exportaciones", icon: "download" }] }
  ];
  return <EnterpriseNavigation areaLabel="Administración" email={email} groups={groups} roleLabel={role === "ADMIN" ? "Administrador" : "Encargado"} />;
}
