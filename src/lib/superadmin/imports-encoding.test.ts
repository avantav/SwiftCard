import { describe, expect, it } from "vitest";
import { parseImportFile } from "./imports";

describe("parseImportFile encoding (SheetJS 0.20)", () => {
  it("keeps accents in UTF-8 CSV files without BOM", async () => {
    const file = new File(["Nombre,Teléfono\nÑandú Güemes,6621234567\n"], "clientes.csv", { type: "text/csv" });
    const parsed = await parseImportFile(file);
    expect(parsed.headers).toEqual(["Nombre", "Teléfono"]);
    expect(parsed.rows).toEqual([{ Nombre: "Ñandú Güemes", Teléfono: "6621234567" }]);
  });
});
