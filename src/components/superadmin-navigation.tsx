import { EnterpriseNavigation, type EnterpriseNavGroup } from "@/components/enterprise-navigation";

const groups: EnterpriseNavGroup[] = [{
  label: "Operación",
  items: [
    { href: "/superadmin", label: "Tenants", icon: "building", matches: ["/superadmin", "/superadmin/tenants"] },
    { href: "/superadmin/imports", label: "Importaciones", icon: "import" }
  ]
}];

export function SuperadminNavigation({ email }: { email: string | null }) {
  return <EnterpriseNavigation areaLabel="Control center" email={email} groups={groups} roleLabel="Superadmin" />;
}
