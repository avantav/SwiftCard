import { WorkspaceSkeleton } from "@/components/admin/workspace-skeleton";

export default function Loading() {
  return <WorkspaceSkeleton breadcrumb="Operación" description="Calculando clientes, visitas y premios del periodo…" title="Estadísticas de clientes" />;
}
