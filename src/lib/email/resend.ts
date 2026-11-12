import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailMessage = {
  to: string;
  /** Display name, usually the tenant name; the address comes from configuration. */
  fromName: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type EmailSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string };

export function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim().toLowerCase();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || null;
  const configured = Boolean(
    apiKey && fromAddress && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(fromAddress),
  );
  return { configured, apiKey: apiKey ?? "", fromAddress: fromAddress ?? "", replyTo };
}

/** Removes characters that could break or inject into the From header. */
export function safeDisplayName(value: string) {
  const cleaned = value.replace(/[\r\n"<>\\,;:@]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return cleaned || "morrow";
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const config = emailConfig();
  if (!config.configured) return { ok: false, error: "Email provider is not configured." };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: `"${safeDisplayName(message.fromName)}" <${config.fromAddress}>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { ok: false, error: `Email provider rejected the message (${response.status}).` };
    }
    const body = (await response.json().catch(() => ({}))) as { id?: unknown };
    return { ok: true, providerMessageId: typeof body.id === "string" ? body.id : null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 200) : "Unknown email error.",
    };
  }
}
