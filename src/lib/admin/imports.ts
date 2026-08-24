import { normalizePhone } from "@/lib/customers/phone";

export const CASA_GARMENDIA_IMPORT_PROFILE_CODE =
  "CASA_GARMENDIA_LEGACY_STAMPS_2026";
export const CASA_GARMENDIA_IMPORT_PROFILE_NAME = "Casa Garmendia";

export const CASA_GARMENDIA_EQUIVALENCES = [
  { legacyStamps: 0, points: 0, reward: "Churro individual" },
  { legacyStamps: 3, points: 100, reward: "2 bebidas de café" },
  { legacyStamps: 4, points: 200, reward: "Chilaquiles sin proteína" },
  { legacyStamps: 6, points: 300, reward: "15% de descuento en un consumo" },
  { legacyStamps: 7, points: 400, reward: "Alimento + bebida sin alcohol" },
  { legacyStamps: 10, points: 500, reward: "Bolsa de Café de la Casa" },
  { legacyStamps: 13, points: 650, reward: "Kit Barista" },
  { legacyStamps: 15, points: 860, reward: "Cena de 3 tiempos para 2 personas" },
] as const;

const expectedHeaders = {
  firstName: "Nombre",
  lastName: "Apellido",
  email: "Email",
  phone: "Teléfono",
  birthDate: "Fecha de Nacimiento",
  legacyStamps: "Estampillas Actuales",
} as const;

export type CasaGarmendiaPreparedRow = {
  source_row: number;
  full_name: string;
  normalized_phone: string;
  email: string;
  birth_date: string;
  legacy_stamps: string;
};

export type CasaGarmendiaImportError = {
  row: number;
  messages: string[];
};

function normalizedLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

export function isCasaGarmendiaTenantName(name: string) {
  const normalized = normalizedLabel(name);
  return normalized.includes("garmendia") || normalized.includes("germendia");
}

export function legacyStampsToLifetimePoints(stamps: number) {
  if (!Number.isInteger(stamps) || stamps < 0 || stamps > 15) return null;
  if (stamps >= 15) return 860;
  if (stamps >= 13) return 650;
  if (stamps >= 10) return 500;
  if (stamps >= 7) return 400;
  if (stamps >= 6) return 300;
  if (stamps >= 4) return 200;
  if (stamps >= 3) return 100;
  return 0;
}

function validIsoDate(year: number, month: number, day: number) {
  if (year < 1900 || year > new Date().getUTCFullYear()) return null;
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) return null;
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  if (value.getTime() > todayUtc) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeCasaGarmendiaBirthDate(input: string) {
  const value = input.trim();
  if (!value) return "";
  const yearFirst = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (yearFirst) {
    return validIsoDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  }
  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  if (dayFirst) {
    return validIsoDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  }
  return null;
}

export function resolveCasaGarmendiaHeaders(headers: readonly string[]) {
  const available = new Map(headers.map((header) => [normalizedLabel(header), header]));
  const resolved = Object.fromEntries(
    Object.entries(expectedHeaders).map(([key, label]) => [key, available.get(normalizedLabel(label))]),
  ) as Partial<Record<keyof typeof expectedHeaders, string>>;
  const missing = Object.entries(expectedHeaders)
    .filter(([key]) => !resolved[key as keyof typeof expectedHeaders])
    .map(([, label]) => label);
  if (missing.length) return { ok: false as const, missing };
  return {
    ok: true as const,
    mapping: resolved as Record<keyof typeof expectedHeaders, string>,
  };
}

export function prepareCasaGarmendiaImport(
  headers: readonly string[],
  rows: Array<Record<string, string>>,
) {
  const headerResult = resolveCasaGarmendiaHeaders(headers);
  if (!headerResult.ok) {
    return {
      ok: false as const,
      error: `Faltan columnas del perfil: ${headerResult.missing.join(", ")}.`,
    };
  }

  const preparedRows: CasaGarmendiaPreparedRow[] = [];
  const errors: CasaGarmendiaImportError[] = [];
  const seenPhones = new Set<string>();
  const mapping = headerResult.mapping;

  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const messages: string[] = [];
    const fullName = [row[mapping.firstName], row[mapping.lastName]]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");
    if (!fullName) messages.push("El nombre y apellido están vacíos.");
    else if (fullName.length > 200) messages.push("El nombre completo supera 200 caracteres.");

    const phone = normalizePhone(row[mapping.phone] ?? "");
    if (!phone.ok) messages.push(phone.error);
    else if (seenPhones.has(phone.value)) messages.push("El teléfono está repetido dentro del archivo.");

    const email = (row[mapping.email] ?? "").trim().toLocaleLowerCase("es-MX");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      messages.push("El correo no es válido.");
    } else if (email.length > 320) {
      messages.push("El correo supera 320 caracteres.");
    }

    const birthDate = normalizeCasaGarmendiaBirthDate(row[mapping.birthDate] ?? "");
    if (birthDate === null) messages.push("La fecha de nacimiento no es válida.");

    const legacyStampsText = (row[mapping.legacyStamps] ?? "").trim();
    const legacyStamps = /^\d+$/.test(legacyStampsText)
      ? Number(legacyStampsText)
      : Number.NaN;
    if (legacyStampsToLifetimePoints(legacyStamps) === null) {
      messages.push("Las estampillas deben ser un entero entre 0 y 15.");
    }

    if (messages.length || !phone.ok || birthDate === null) {
      errors.push({ row: sourceRow, messages });
      return;
    }

    seenPhones.add(phone.value);
    preparedRows.push({
      source_row: sourceRow,
      full_name: fullName,
      normalized_phone: phone.value,
      email,
      birth_date: birthDate,
      legacy_stamps: String(legacyStamps),
    });
  });

  return {
    ok: true as const,
    mapping,
    preparedRows,
    errors,
  };
}
