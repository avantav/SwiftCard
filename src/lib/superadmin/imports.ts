export const importMimeTypes = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
] as const;

export type ImportMimeType = (typeof importMimeTypes)[number];

const maxImportSizeBytes = 10 * 1024 * 1024;

export function validateImportFile(file: File) {
  if (!file || file.size <= 0) return { ok: false as const, error: "Selecciona un archivo." };
  if (file.size > maxImportSizeBytes) return { ok: false as const, error: "El archivo supera el límite de 10 MB." };
  if (!importMimeTypes.includes(file.type as ImportMimeType)) return { ok: false as const, error: "El archivo debe ser CSV o Excel." };
  return { ok: true as const };
}

export function importFileType(file: File): ImportMimeType {
  return file.type as ImportMimeType;
}

export async function parseImportFile(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false, codepage: 65001 });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!firstSheet) throw new Error("El archivo no contiene hojas.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "", raw: false });
  const headers = (matrix.shift() ?? []).map((value) => String(value).trim());
  if (headers.length === 0 || headers.every((header) => header.length === 0)) throw new Error("El archivo no contiene encabezados.");

  const rows = matrix
    .filter((row) => row.some((value) => String(value).trim().length > 0))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, String(row[index] ?? "").trim()])));

  return { headers, rows };
}

export type ImportColumnMapping = {
  fullName: string;
  phone: string;
  email?: string;
  birthDate?: string;
  initialStamps?: string;
};

export function validateMappedRows(rows: Array<Record<string, string>>, mapping: ImportColumnMapping) {
  const errors: Array<{ row: number; messages: string[] }> = [];
  rows.forEach((row, index) => {
    const messages: string[] = [];
    if (!row[mapping.fullName]?.trim()) messages.push("El nombre es obligatorio.");
    const phone = normalizePhone(row[mapping.phone] ?? "");
    if (!phone.ok) messages.push(phone.error);
    if (mapping.email && row[mapping.email]?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[mapping.email].trim())) messages.push("El correo no es válido.");
    if (mapping.birthDate && row[mapping.birthDate]?.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(row[mapping.birthDate].trim())) messages.push("La fecha debe usar formato AAAA-MM-DD.");
    if (mapping.initialStamps && row[mapping.initialStamps]?.trim() && !/^\d+$/.test(row[mapping.initialStamps].trim())) messages.push("Los sellos iniciales deben ser un entero no negativo.");
    if (messages.length) errors.push({ row: index + 2, messages });
  });
  return errors;
}
import * as XLSX from "xlsx";
import { normalizePhone } from "@/lib/customers/phone";
