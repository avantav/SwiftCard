"use server";

import { redirect } from "next/navigation";
import { startSelfServiceSignup } from "@/lib/billing/self-service-signup";
import { parseInterval, parsePlanCode, validateSignup } from "@/lib/billing/signup-validation";

export type SignupFormValues = {
  plan: string;
  interval: "MONTH" | "YEAR";
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
};

export type SignupFormState = { error: string | null; values: SignupFormValues };

function retainedValues(formData: FormData): SignupFormValues {
  const value = (name: string) => {
    const entry = formData.get(name);
    return typeof entry === "string" ? entry.trim().slice(0, 254) : "";
  };
  return {
    plan: parsePlanCode(value("plan")) ?? "inicial",
    interval: parseInterval(value("interval")),
    businessName: value("businessName"),
    fullName: value("fullName"),
    email: value("email"),
    phone: value("phone"),
  };
}

/** Never returns passwords to the browser; on success redirects to Stripe Checkout. */
export async function submitSignup(_previous: SignupFormState, formData: FormData): Promise<SignupFormState> {
  const values = retainedValues(formData);
  const validation = validateSignup(formData);
  if (!validation.ok) return { error: validation.errors.join(" "), values };

  const result = await startSelfServiceSignup(validation.data);
  if (!result.ok) return { error: result.error, values };
  redirect(result.checkoutUrl);
}
