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
