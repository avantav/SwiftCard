import { describe, expect, it } from "vitest";
import { isNoticeCode, noticeMessage, withNotice, withoutNotice } from "./notices";
import {
  errorState,
  fieldErrorMessages,
  firstStepWithError,
  hasFieldErrors,
  initialFormState,
  readValues,
  successState,
  supportReadOnlyState,
} from "./state";

describe("form state contract", () => {
  it("builds idle, error and success states that keep the values", () => {
    const values = { name: "Centro", email: "" };
    expect(initialFormState(values)).toEqual({ status: "idle", formError: null, fieldErrors: {}, values });
    expect(errorState(values, { name: ["Escribe el nombre."] }, "Revisa los campos.")).toEqual({
      status: "error", formError: "Revisa los campos.", fieldErrors: { name: ["Escribe el nombre."] }, values,
    });
    expect(successState(values, "branch_created")).toMatchObject({ status: "success", notice: "branch_created", values });
    expect(supportReadOnlyState(values)).toMatchObject({ status: "error", values, formError: expect.stringContaining("solo lectura") });
  });

  it("reads trimmed strings and treats missing or file values as empty", () => {
    const formData = new FormData();
    formData.set("name", "  Centro  ");
    formData.set("file", new Blob(["x"]));
    expect(readValues(formData, ["name", "file", "missing"] as const)).toEqual({ name: "Centro", file: "", missing: "" });
  });

  it("summarizes field errors and finds the wizard step that owns them", () => {
    const errors = { address: ["Elige la ubicación."], name: [], sharedEmail: ["Correo inválido.", "Correo inválido."] };
    expect(hasFieldErrors(errors)).toBe(true);
    expect(hasFieldErrors({ name: [] })).toBe(false);
    expect(fieldErrorMessages(errors)).toEqual(["Elige la ubicación.", "Correo inválido."]);
    const steps = [["name"], ["address", "latitude"], ["sharedEmail"]] as const;
    expect(firstStepWithError(errors, steps)).toBe(1);
    expect(firstStepWithError({ sharedEmail: ["x"] }, steps)).toBe(2);
    expect(firstStepWithError({}, steps)).toBe(-1);
  });
});

describe("toast notices", () => {
  it("only accepts known codes and never echoes URL text", () => {
    expect(isNoticeCode("branch_created")).toBe(true);
    expect(isNoticeCode("constructor")).toBe(false);
    expect(isNoticeCode("<script>")).toBe(false);
    expect(noticeMessage("branch_created")).toBe("Sucursal creada.");
    expect(noticeMessage("Hackeado")).toBeNull();
  });

  it("adds and removes the notice param keeping the rest of the URL", () => {
    expect(withNotice("/admin/branches", "branch_created")).toBe("/admin/branches?notice=branch_created");
    expect(withNotice("/admin/staff?branch=abc#lista", "staff_created")).toBe("/admin/staff?branch=abc&notice=staff_created#lista");
    expect(withoutNotice("/admin/staff", "branch=abc&notice=staff_created")).toBe("/admin/staff?branch=abc");
    expect(withoutNotice("/admin", "notice=saved")).toBe("/admin");
  });
});
