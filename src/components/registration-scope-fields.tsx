"use client";

import { useState } from "react";

export type RegistrationScope = {
  loyalty_card_id: string;
  card_name: string;
  branch_id: string;
  branch_name: string;
};

export function RegistrationScopeFields({ scopes }: { scopes: RegistrationScope[] }) {
  const cards = Array.from(
    new Map(scopes.map((scope) => [scope.loyalty_card_id, scope.card_name])).entries(),
    ([id, name]) => ({ id, name }),
  );
  const initialCardId = cards.length === 1 ? cards[0].id : "";
  const initialBranches = scopes.filter((scope) => scope.loyalty_card_id === initialCardId);
  const [cardId, setCardId] = useState(initialCardId);
  const [branchId, setBranchId] = useState(initialBranches.length === 1 ? initialBranches[0].branch_id : "");
  const branches = scopes.filter((scope) => scope.loyalty_card_id === cardId);

  function selectCard(nextCardId: string) {
    const nextBranches = scopes.filter((scope) => scope.loyalty_card_id === nextCardId);
    setCardId(nextCardId);
    setBranchId(nextBranches.length === 1 ? nextBranches[0].branch_id : "");
  }

  return <>
    <label className="field"><span>Tarjeta</span><select name="loyaltyCardId" required value={cardId} onChange={(event) => selectCard(event.target.value)}><option value="">Selecciona una tarjeta</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>
    <label className="field"><span>Sucursal participante</span><select name="branchId" required value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={!cardId}><option value="">{cardId ? "Selecciona una sucursal" : "Primero selecciona una tarjeta"}</option>{branches.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}</select><small>Solo aparecen las sucursales habilitadas para esta tarjeta.</small></label>
  </>;
}
