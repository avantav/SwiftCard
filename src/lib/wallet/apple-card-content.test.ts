import { describe, expect, it } from "vitest";
import {
  appleWalletPointProgressText,
  appleWalletProgressText,
  appleWalletRewardTierText,
} from "./apple-card-content";

describe("Apple Wallet card content", () => {
  it("uses the program's configured unit names in progress and reward copy", () => {
    expect(appleWalletProgressText({
      balance: 4,
      goal: 10,
      unitNameSingular: "visita",
      unitNamePlural: "visitas",
    })).toBe("4 de 10 visitas");
    expect(appleWalletProgressText({
      balance: 1,
      goal: null,
      unitNameSingular: "punto",
      unitNamePlural: "puntos",
    })).toBe("1 punto");
    expect(appleWalletRewardTierText({
      required: 5,
      name: "Postre",
      description: "Un postre de la casa",
      unitNamePlural: "visitas",
    })).toBe("5 visitas · Postre: Un postre de la casa");
  });

  it("keeps point progress visible when Wallet omits strip images", () => {
    expect(appleWalletPointProgressText({ balance: 200, goal: 300 })).toBe(
      "■■■□□ 200/300",
    );
    expect(appleWalletPointProgressText({
      balance: 860,
      goal: null,
      complete: true,
    })).toBe("■■■■■ Completo");
  });
});
