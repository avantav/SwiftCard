import { normalizePhone } from "@/lib/customers/phone";

export const SIGNUP_PLAN_CODES = ["inicial", "crecimiento"] as const;
export type SignupPlanCode = (typeof SIGNUP_PLAN_CODES)[number];
export type SignupInterval = "MONTH" | "YEAR";

export type SignupInput = {
  planCode: SignupPlanCode;
  interval: SignupInterval;
  businessName: string;
  fullName: string;
  email: string;
  phone: string | null;
  password: string;
};

export type SignupValidation =
  | { ok: true; data: SignupInput }
  | { ok: false; errors: string[]; bot?: boolean };

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parsePlanCode(value: unknown): SignupPlanCode | null {
  return typeof value === "string" && (SIGNUP_PLAN_CODES as readonly string[]).includes(value)
    ? (value as SignupPlanCode)
    : null;
}

export function parseInterval(value: unknown): SignupInterval {
  return value === "YEAR" ? "YEAR" : "MONTH";
}

export function validateSignup(formData: FormData): SignupValidation {
  // Honeypot: real people never see or fill this field.
  if (text(formData, "website")) return { ok: false, errors: ["No se pudo completar el registro."], bot: true };

  const errors: string[] = [];
  const planCode = parsePlanCode(text(formData, "plan"));
  const interval = parseInterval(text(formData, "interval"));
  const businessName = text(formData, "businessName").replace(/\s+/g, " ");
  const fullName = text(formData, "fullName").replace(/\s+/g, " ");
  const email = text(formData, "email").toLowerCase();
  const rawPhone = text(formData, "phone");
  const password = formData.get("password");
  const confirmation = formData.get("passwordConfirmation");

  if (!planCode) errors.push("Elige el plan Inicial o Crecimiento.");
  if (businessName.length < 2 || businessName.length > 120) errors.push("El nombre del negocio debe tener entre 2 y 120 caracteres.");
  if (fullName.length < 2 || fullName.length > 120) errors.push("Tu nombre debe tener entre 2 y 120 caracteres.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.push("El correo no es válido.");

  let phone: string | null = null;
  if (rawPhone) {
    const normalized = normalizePhone(rawPhone);
    if (normalized.ok) phone = normalized.value;
    else errors.push(normalized.error);
  }

  if (typeof password !== "string" || password.length < 12 || password.length > 72) {
    errors.push("La contraseña debe tener entre 12 y 72 caracteres.");
  } else if (password !== confirmation) {
    errors.push("Las contraseñas no coinciden.");
  }
  if (formData.get("acceptTerms") !== "on") errors.push("Debes aceptar los términos del servicio y el aviso de privacidad.");

  if (errors.length || !planCode || typeof password !== "string") return { ok: false, errors };
  return { ok: true, data: { planCode, interval, businessName, fullName, email, phone, password } };
}
