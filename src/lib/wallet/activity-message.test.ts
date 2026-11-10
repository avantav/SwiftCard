import { describe, expect, it } from "vitest";
import {
  composeWalletActivityMessage,
  WALLET_ACTIVITY_EMPTY_MESSAGE,
  WALLET_ACTIVITY_MESSAGE_MAX_LENGTH,
  type WalletActivityContext,
} from "./activity-message";

const stamps: WalletActivityContext = {
  balance: 6,
  availableRewards: 0,
  rewardGoal: 10,
  rewardTiers: [{ stampsRequired: 10, name: "Café gratis" }],
  unitNameSingular: "sello",
  unitNamePlural: "sellos",
};

const points: WalletActivityContext = {
  balance: 120,
  availableRewards: 1,
  rewardGoal: null,
  rewardTiers: [
    { stampsRequired: 100, name: "Postre" },
    { stampsRequired: 250, name: "Comida para dos" },
  ],
  unitNameSingular: "punto",
  unitNamePlural: "puntos",
};

describe("composeWalletActivityMessage", () => {
  it("describes an empty card without an event key", () => {
    const message = composeWalletActivityMessage({ kind: "NONE" }, stamps);
    expect(message).toMatchObject({ kind: "NONE", eventKey: null, body: WALLET_ACTIVITY_EMPTY_MESSAGE });
  });

  it("confirms a purchase with the new balance and the next goal", () => {
    const message = composeWalletActivityMessage(
      { kind: "PURCHASE", id: "p1", occurredAt: "2026-11-09T10:00:00Z", unitsAwarded: 1, unlockedRewardNames: [] },
      stamps,
    );
    expect(message.kind).toBe("PURCHASE");
    expect(message.eventKey).toBe("purchase-p1");
    expect(message.body).toBe(
      "¡Gracias por tu compra! Sumaste 1 sello. Ahora tienes 6 sellos. Te faltan 4 sellos para Café gratis.",
    );
  });

  it("uses the next lifetime tier and fractional awarded points", () => {
    const message = composeWalletActivityMessage(
      { kind: "PURCHASE", id: "p2", occurredAt: "2026-11-09T10:00:00Z", unitsAwarded: 12.5, unlockedRewardNames: [] },
      points,
    );
    expect(message.body).toBe(
      "¡Gracias por tu compra! Sumaste 12.5 puntos. Ahora tienes 120 puntos. Te faltan 130 puntos para Comida para dos.",
    );
  });

  it("acknowledges purchases that award no units", () => {
    const message = composeWalletActivityMessage(
      { kind: "PURCHASE", id: "p3", occurredAt: "2026-11-09T10:00:00Z", unitsAwarded: 0, unlockedRewardNames: [] },
      { ...stamps, balance: 9 },
    );
    expect(message.body).toBe("Registramos tu compra. Tienes 9 sellos. Te falta 1 sello para Café gratis.");
  });

  it("prefers the unlocked-reward message so one purchase sends one notice", () => {
    const message = composeWalletActivityMessage(
      { kind: "PURCHASE", id: "p4", occurredAt: "2026-11-09T10:00:00Z", unitsAwarded: 1, unlockedRewardNames: ["Café gratis"] },
      { ...stamps, balance: 0, availableRewards: 1 },
    );
    expect(message).toMatchObject({
      kind: "REWARD_UNLOCKED",
      eventKey: "reward-unlocked-p4",
      title: "¡Premio desbloqueado!",
      body: "¡Felicidades! Desbloqueaste Café gratis. Muéstralo en caja para canjearlo.",
    });
  });

  it("lists several unlocked rewards", () => {
    const message = composeWalletActivityMessage(
      { kind: "PURCHASE", id: "p5", occurredAt: "2026-11-09T10:00:00Z", unitsAwarded: 300, unlockedRewardNames: ["Postre", "Comida para dos"] },
      points,
    );
    expect(message.body).toBe(
      "¡Felicidades! Desbloqueaste 2 premios: Postre y Comida para dos. Muéstralos en caja para canjearlos.",
    );
  });

  it("confirms a redemption with the remaining rewards", () => {
    expect(
      composeWalletActivityMessage(
        { kind: "REDEMPTION", id: "r1", occurredAt: "2026-11-09T10:00:00Z", rewardName: "Postre" },
        points,
      ),
    ).toMatchObject({
      kind: "REWARD_REDEEMED",
      eventKey: "reward-redeemed-r1",
      body: "Canjeaste Postre. ¡Disfrútalo! Te queda 1 premio disponible.",
    });
    expect(
      composeWalletActivityMessage(
        { kind: "REDEMPTION", id: "r2", occurredAt: "2026-11-09T10:00:00Z", rewardName: "Café gratis" },
        stamps,
      ).body,
    ).toBe("Canjeaste Café gratis. ¡Disfrútalo! Sigue sumando sellos con cada compra.");
  });

  it("never exceeds the lock-screen length and never includes customer data", () => {
    const message = composeWalletActivityMessage(
      { kind: "PURCHASE", id: "p6", occurredAt: "2026-11-09T10:00:00Z", unitsAwarded: 1, unlockedRewardNames: ["Premio ".repeat(40)] },
      stamps,
    );
    expect(message.body.length).toBeLessThanOrEqual(WALLET_ACTIVITY_MESSAGE_MAX_LENGTH);
    expect(message.body.endsWith("…")).toBe(true);
  });
});
