import { WorkspaceSkeleton } from "@/components/admin/workspace-skeleton";

export default function Loading() {
  return <WorkspaceSkeleton breadcrumb="Configuración / Facturación" description="Consultando tu paquete y consumo…" title="Plan y uso" />;
}
