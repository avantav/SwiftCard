import { EnterpriseNavigation, type EnterpriseNavGroup } from "@/components/enterprise-navigation";

const groups: EnterpriseNavGroup[] = [{
  label: "Operación",
  items: [
    { href: "/superadmin", label: "Tenants", icon: "building", matches: ["/superadmin/tenants"] },
    { href: "/superadmin/imports", label: "Importaciones", icon: "import" },
    { href: "/superadmin/billing/packages", label: "Paquetes", icon: "cart" },
    { href: "/superadmin/billing/promotions", label: "Promociones", icon: "award" },
    { href: "/superadmin/billing/affiliates", label: "Afiliados", icon: "user-plus" }
  ]
}];

export function SuperadminNavigation({ email }: { email: string | null }) {
  return <EnterpriseNavigation areaLabel="Control center" email={email} groups={groups} roleLabel="Superadmin" />;
}
