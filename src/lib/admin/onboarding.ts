/**
 * First-run setup checklist for the Admin general (DEC-0073). Pure: the
 * counts come from RLS-scoped queries in `onboarding-server.ts`.
 */

export type SetupCounts = {
  legalComplete: boolean;
  activeBranches: number;
  branchesWithoutLocation: number;
  publishedCards: number;
  staffMembers: number;
};

export type SetupStep = {
  id: "legal" | "branch" | "location" | "card" | "staff";
  label: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
};

export type SetupChecklist = {
  steps: SetupStep[];
  completed: number;
  total: number;
  next: SetupStep | null;
};

export function buildSetupChecklist(counts: SetupCounts): SetupChecklist {
  const steps: SetupStep[] = [
    {
      id: "legal",
      label: "Datos legales del negocio",
      description: "Razón social y domicilio para tus términos y aviso de privacidad.",
      done: counts.legalComplete,
      href: "/admin/legal",
      cta: "Completar datos legales",
    },
    {
      id: "branch",
      label: "Primera sucursal",
      description: "Conecta clientes, personal y operación con una ubicación.",
      done: counts.activeBranches > 0,
      href: "/admin/branches?view=create",
      cta: "Crear sucursal",
    },
    {
      id: "location",
      label: "Ubicación de las sucursales",
      description: counts.branchesWithoutLocation > 0
        ? `${counts.branchesWithoutLocation} ${counts.branchesWithoutLocation === 1 ? "sucursal activa necesita" : "sucursales activas necesitan"} un punto en el mapa.`
        : "Cada sucursal activa tiene su punto en el mapa para GPS y avisos cercanos.",
      done: counts.activeBranches > 0 && counts.branchesWithoutLocation === 0,
      href: "/admin/branches",
      cta: "Ubicar sucursales",
    },
    {
      id: "card",
      label: "Tarjeta publicada",
      description: "Programa, diseño y sucursales listos para que tus clientes se registren.",
      done: counts.publishedCards > 0,
      href: "/admin/cards",
      cta: "Configurar tarjeta",
    },
    {
      id: "staff",
      label: "Personal para operar",
      description: "Agrega a quienes registrarán compras y canjes en la sucursal.",
      done: counts.staffMembers > 0,
      href: "/admin/staff",
      cta: "Agregar personal",
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  return { steps, completed, total: steps.length, next: steps.find((step) => !step.done) ?? null };
}
