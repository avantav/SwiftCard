/**
 * Transactional customer email templates (MVP, fixed Spanish copy).
 * Every dynamic value is HTML-escaped; links and images must be HTTPS.
 */

export type EmailBrand = {
  tenantName: string;
  logoUrl: string | null;
  backgroundColor: string;
  showMorrowAttribution: boolean;
};

export type WelcomeEmailInput = {
  brand: EmailBrand;
  customerName: string;
  programName: string;
  cardUrl: string;
  unitNamePlural: string;
  welcomeRewardName: string | null;
  nextRewardText: string | null;
};

export type RewardEmailInput = {
  brand: EmailBrand;
  customerName: string;
  rewardNames: string[];
  cardUrl: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const FALLBACK_COLOR = "#10253D";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function firstName(fullName: string) {
  return clean(fullName).split(" ")[0]?.slice(0, 40) || "";
}

function safeColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : FALLBACK_COLOR;
}

function luminance(hex: string) {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Black or white text, whichever has the higher WCAG contrast on the brand color. */
export function readableTextColor(background: string) {
  const light = luminance(safeColor(background));
  const contrastWhite = 1.05 / (light + 0.05);
  const contrastBlack = (light + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#FFFFFF" : "#111827";
}

function safeHttpsUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function listNames(names: string[]) {
  const cleaned = names.map(clean).filter(Boolean);
  if (cleaned.length <= 1) return cleaned[0] ?? "un premio";
  return `${cleaned.slice(0, -1).join(", ")} y ${cleaned.at(-1)}`;
}

function layout(input: {
  brand: EmailBrand;
  preheader: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerText: string;
}) {
  const color = safeColor(input.brand.backgroundColor);
  const textColor = readableTextColor(color);
  const tenant = escapeHtml(clean(input.brand.tenantName));
  const logo = safeHttpsUrl(input.brand.logoUrl);
  const ctaUrl = safeHttpsUrl(input.ctaUrl);
  const header = logo
    ? `<img src="${escapeHtml(logo)}" alt="${tenant}" height="56" style="display:block;margin:0 auto;max-height:56px;max-width:200px;border:0;">`
    : `<span style="font-size:20px;font-weight:600;color:${textColor};">${tenant}</span>`;
  const button = ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:${color};"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:${textColor};text-decoration:none;border-radius:8px;">${escapeHtml(input.ctaLabel)}</a></td></tr></table>`
    : "";
  const attribution = input.brand.showMorrowAttribution
    ? `<p style="margin:12px 0 0;font-size:12px;color:#667085;">Powered by <strong>morrow</strong></p>`
    : "";

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${tenant}</title></head>
<body style="margin:0;padding:0;background:#F5F7F8;font-family:Inter,Arial,Helvetica,sans-serif;color:#111827;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7F8;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E4E7EC;border-radius:12px;overflow:hidden;">
<tr><td align="center" style="background:${logo ? "#FFFFFF" : color};padding:24px;border-bottom:1px solid #E4E7EC;">${header}</td></tr>
<tr><td style="padding:32px 24px;font-size:16px;line-height:1.6;">${input.bodyHtml}${button}</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #E4E7EC;font-size:13px;line-height:1.5;color:#667085;"><p style="margin:0;">${escapeHtml(input.footerText)}</p>${attribution}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function footer(tenantName: string) {
  return `Recibes este correo porque te registraste en el programa de lealtad de ${clean(tenantName)}. Si no fuiste tú, ignora este mensaje.`;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const tenantName = clean(input.brand.tenantName);
  const name = firstName(input.customerName);
  const greeting = name ? `Hola ${name},` : "Hola,";
  const welcomeReward = input.welcomeRewardName ? clean(input.welcomeRewardName) : null;
  const subject = welcomeReward
    ? `¡Bienvenido! Tienes un regalo en ${tenantName}`
    : `Bienvenido a ${clean(input.programName)} de ${tenantName}`;
  const intro = `Ya eres parte de ${clean(input.programName)}. Con cada compra en ${tenantName} sumas ${clean(input.unitNamePlural)} y ganas premios.`;
  const rewardLine = welcomeReward
    ? `Tu regalo de bienvenida: ${welcomeReward}. Muéstralo en caja para canjearlo.`
    : null;
  const nextLine = input.nextRewardText ? clean(input.nextRewardText) : null;
  const walletLine = "Abre tu tarjeta para agregarla a Apple Wallet o Google Wallet y tenerla siempre a la mano.";

  const bodyHtml = [
    `<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 16px;">${escapeHtml(intro)}</p>`,
    rewardLine
      ? `<p style="margin:0 0 16px;padding:16px;background:#ECFDF3;border:1px solid #ABEFC6;border-radius:8px;color:#087A55;font-weight:600;">${escapeHtml(rewardLine)}</p>`
      : "",
    nextLine ? `<p style="margin:0 0 16px;">${escapeHtml(nextLine)}</p>` : "",
    `<p style="margin:0;">${escapeHtml(walletLine)}</p>`,
  ].join("");

  const text = [greeting, "", intro, rewardLine ? `\n${rewardLine}` : "", nextLine ?? "", "", walletLine, `Abrir mi tarjeta: ${input.cardUrl}`, "", footer(tenantName)]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");

  return {
    subject,
    html: layout({
      brand: input.brand,
      preheader: rewardLine ?? intro,
      bodyHtml,
      ctaLabel: "Abrir mi tarjeta",
      ctaUrl: input.cardUrl,
      footerText: footer(tenantName),
    }),
    text,
  };
}

export function renderRewardEmail(input: RewardEmailInput): RenderedEmail {
  const tenantName = clean(input.brand.tenantName);
  const name = firstName(input.customerName);
  const greeting = name ? `Hola ${name},` : "Hola,";
  const count = input.rewardNames.filter((reward) => clean(reward)).length || 1;
  const rewards = listNames(input.rewardNames);
  const subject = count === 1
    ? `¡Ganaste ${rewards} en ${tenantName}!`
    : `¡Ganaste ${count} premios en ${tenantName}!`;
  const congrats = `¡Felicidades! Con tu última compra en ${tenantName} ganaste: ${rewards}.`;
  const howTo = count === 1
    ? "Muéstralo en caja para canjearlo. También lo verás en tu tarjeta."
    : "Muéstralos en caja para canjearlos. También los verás en tu tarjeta.";

  const bodyHtml = [
    `<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 16px;padding:16px;background:#ECFDF3;border:1px solid #ABEFC6;border-radius:8px;color:#087A55;font-weight:600;">${escapeHtml(congrats)}</p>`,
    `<p style="margin:0;">${escapeHtml(howTo)}</p>`,
  ].join("");

  return {
    subject,
    html: layout({
      brand: input.brand,
      preheader: congrats,
      bodyHtml,
      ctaLabel: "Ver mi tarjeta",
      ctaUrl: input.cardUrl,
      footerText: footer(tenantName),
    }),
    text: [greeting, "", congrats, howTo, "", `Ver mi tarjeta: ${input.cardUrl}`, "", footer(tenantName)].join("\n"),
  };
}
