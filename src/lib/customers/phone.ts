export type PhoneNormalizationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePhone(input: string): PhoneNormalizationResult {
  const value = input.trim();

  if (!value) {
    return { ok: false, error: "El teléfono es obligatorio." };
  }

  if (/[A-Za-z]/.test(value)) {
    return { ok: false, error: "El teléfono contiene caracteres inválidos." };
  }

  const compact = value.replace(/[\s().-]/g, "");
  const hasPlus = compact.startsWith("+");
  const withoutPrefix = hasPlus ? compact.slice(1) : compact;
  const normalizedDigits = withoutPrefix.startsWith("00")
    ? withoutPrefix.slice(2)
    : withoutPrefix;

  if (!/^\d+$/.test(normalizedDigits)) {
    return { ok: false, error: "El teléfono contiene caracteres inválidos." };
  }

  if (normalizedDigits.startsWith("52") && normalizedDigits.length === 13) {
    const mexicanMobilePrefix = normalizedDigits.slice(2, 3);
    if (mexicanMobilePrefix === "1") {
      return normalizeInternational(`+52${normalizedDigits.slice(3)}`);
    }
  }

  if (!hasPlus && !value.startsWith("00") && normalizedDigits.length === 10) {
    return normalizeInternational(`+52${normalizedDigits}`);
  }

  return normalizeInternational(`+${normalizedDigits}`);
}

function normalizeInternational(value: string): PhoneNormalizationResult {
  const phoneDigits = digits(value.slice(1));

  if (!/^\+[1-9]\d{7,14}$/.test(`+${phoneDigits}`)) {
    return {
      ok: false,
      error: "El teléfono debe tener entre 8 y 15 dígitos internacionales."
    };
  }

  return { ok: true, value: `+${phoneDigits}` };
}
