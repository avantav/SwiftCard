import { WorkspaceSkeleton } from "@/components/admin/workspace-skeleton";

export default function Loading() {
  return <WorkspaceSkeleton breadcrumb="Datos" description="Cargando el perfil de importación…" title="Importar clientes" />;
}
