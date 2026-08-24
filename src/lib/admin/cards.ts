export type AdminCardListRow = {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  current_step: number;
  updated_at: string;
  program_completed?: boolean;
  design_completed?: boolean;
  locations_completed?: boolean;
};

function normalizedDraftName(name: string) {
  return name.trim().toLocaleLowerCase("es-MX");
}

function completedStageCount(card: AdminCardListRow) {
  return Number(card.program_completed === true)
    + Number(card.design_completed === true)
    + Number(card.locations_completed === true);
}

export function consolidateDraftCards<T extends AdminCardListRow>(cards: readonly T[]) {
  const preferredDraft = new Map<string, T>();

  for (const card of cards) {
    if (card.status !== "DRAFT") continue;
    const key = normalizedDraftName(card.name);
    const current = preferredDraft.get(key);
    if (
      !current ||
      card.current_step > current.current_step ||
      (card.current_step === current.current_step &&
        (completedStageCount(card) > completedStageCount(current) ||
          (completedStageCount(card) === completedStageCount(current) &&
            card.updated_at > current.updated_at)))
    ) {
      preferredDraft.set(key, card);
    }
  }

  return cards.filter(
    (card) =>
      card.status !== "DRAFT" ||
      preferredDraft.get(normalizedDraftName(card.name))?.id === card.id,
  );
}
