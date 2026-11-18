import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  legalConsentErrorMessage,
  legalConsentPending,
  parseLegalConsentStatus,
  safeLegalReturnPath,
  validateLegalProfile,
} from "./consent";

const row = {
  acceptance_required: true,
  company_info_required: true,
  can_edit_company: true,
  tenant_name: "Casa Ejemplo",
  legal_name: null,
  legal_address: null,
  legal_contact_email: null,
  contact_email: "dueno@example.com",
};

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("legal consent status", () => {
  it("parses the RPC row and detects pending acceptance or company data", () => {
    const status = parseLegalConsentStatus([row]);
    expect(status).toMatchObject({ acceptanceRequired: true, companyInfoRequired: true, canEditCompany: true, tenantName: "Casa Ejemplo", contactEmail: "dueno@example.com" });
    expect(legalConsentPending(status)).toBe(true);
    expect(legalConsentPending(parseLegalConsentStatus([{ ...row, acceptance_required: false, company_info_required: false }]))).toBe(false);
    expect(legalConsentPending(parseLegalConsentStatus([{ ...row, acceptance_required: false }]))).toBe(true);
  });

  it("treats an empty or malformed answer as nothing to accept", () => {
    expect(parseLegalConsentStatus([])).toBeNull();
    expect(parseLegalConsentStatus(null)).toBeNull();
    expect(parseLegalConsentStatus([{ acceptance_required: "yes" }])).toBeNull();
    expect(legalConsentPending(null)).toBe(false);
  });
});

describe("legal profile validation", () => {
  it("normalizes valid data and keeps the email optional", () => {
    const result = validateLegalProfile(form({ legalName: "  Casa   Ejemplo, S.A. de C.V. ", legalAddress: "Calle Uno 123, Centro, 83000 Hermosillo, Sonora", legalContactEmail: "" }));
    expect(result).toEqual({ data: { legalName: "Casa Ejemplo, S.A. de C.V.", legalAddress: "Calle Uno 123, Centro, 83000 Hermosillo, Sonora", legalContactEmail: null } });
    const withEmail = validateLegalProfile(form({ legalName: "Casa", legalAddress: "Calle Uno 123, Hermosillo", legalContactEmail: "Privacidad@Example.com" }));
    expect("data" in withEmail && withEmail.data.legalContactEmail).toBe("privacidad@example.com");
  });

  it("reports each invalid field and preserves the typed values", () => {
    const result = validateLegalProfile(form({ legalName: "C", legalAddress: "corta", legalContactEmail: "no-es-correo" }));
    expect("state" in result).toBe(true);
    if ("state" in result) {
      expect(Object.keys(result.state.fieldErrors ?? {}).sort()).toEqual(["legalAddress", "legalContactEmail", "legalName"]);
      expect(result.state.values).toEqual({ legalName: "C", legalAddress: "corta", legalContactEmail: "no-es-correo" });
    }
  });
});

describe("legal consent helpers", () => {
  it("maps RPC errors without exposing database details", () => {
    expect(legalConsentErrorMessage("legal_profile_incomplete")).toContain("razón social");
    expect(legalConsentErrorMessage("legal_profile_forbidden")).toBe("Tu cuenta no puede realizar esta acción.");
    expect(legalConsentErrorMessage('relation "x" does not exist')).toBe("No se pudo guardar la aceptación. Intenta de nuevo.");
  });

  it("only returns to paths inside the same area", () => {
    expect(safeLegalReturnPath("/admin/cards?tab=1", "ADMIN")).toBe("/admin/cards?tab=1");
    expect(safeLegalReturnPath("/app/scan", "APP")).toBe("/app/scan");
    expect(safeLegalReturnPath("/app/scan", "ADMIN")).toBe("/admin");
    expect(safeLegalReturnPath("//evil.example", "ADMIN")).toBe("/admin");
    expect(safeLegalReturnPath("https://evil.example/admin", "ADMIN")).toBe("/admin");
    expect(safeLegalReturnPath("/administrator", "ADMIN")).toBe("/admin");
    expect(safeLegalReturnPath(null, "APP")).toBe("/app");
  });
});

describe("legal consent boundaries", () => {
  const migration = readFileSync("supabase/migrations/0080_tenant_legal_consent.sql", "utf8");
  const server = readFileSync("src/lib/auth/server.ts", "utf8");
  const adminLayout = readFileSync("src/app/admin/layout.tsx", "utf8");
  const appLayout = readFileSync("src/app/app/layout.tsx", "utf8");
  const actions = readFileSync("src/app/legal-consent/actions.ts", "utf8");

  it("keeps acceptances append-only and tenant legal data behind audited RPCs", () => {
    expect(migration).toContain("alter table public.staff_legal_acceptances force row level security");
    expect(migration).toContain("revoke all on public.staff_legal_acceptances from public, anon, authenticated");
    expect(migration).toContain("legal acceptances are append-only");
    expect(migration).toContain("'TENANT_LEGAL_PROFILE_UPDATED'");
    expect(migration).toContain("'PLATFORM_LEGAL_TERMS_ACCEPTED'");
    expect(migration).toContain("subject.role <> 'ADMIN'");
    expect(migration).toContain("legal_profile_incomplete");
  });

  it("blocks writes and pages until acceptance, except for support sessions", () => {
    expect(server).toContain("options.writable &&\n    !options.allowPendingLegal");
    expect(server).toContain("!context.supportSession");
    expect(adminLayout).toContain("context.supportSession ? null : await getLegalConsentStatus");
    expect(adminLayout).toContain("{gate ?? children}");
    expect(appLayout).toContain('if (pending?.canEditCompany) redirect("/admin")');
    expect(actions).toContain("allowPendingLegal: true");
    expect(actions).toContain('context.access.role !== "ADMIN"');
  });
});
