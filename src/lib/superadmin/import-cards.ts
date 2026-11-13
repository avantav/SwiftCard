/** Card choice for the generic customer import (DEC-0065). */

/** Tells the Superadmin how initial stamps will be converted for each card. */
export function importCardLabel(name: string, programType: string | null | undefined, multiplier: number | null | undefined) {
  if (programType === "LIFETIME_POINTS") {
    const factor = Number.isInteger(multiplier) && (multiplier ?? 0) > 0 ? multiplier : 1;
    return `${name} · puntos acumulados (1 sello = ${factor} ${factor === 1 ? "punto" : "puntos"})`;
  }
  return `${name} · sellos`;
}
