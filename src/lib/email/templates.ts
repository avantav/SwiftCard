/**
 * Transactional customer email templates (MVP, fixed Spanish copy).
 * Every dynamic value is HTML-escaped; links and images must be HTTPS.
 *
 * The look mirrors public registration (`/register/[branchToken]`): a single
 * white card on the neutral canvas, the business logo in a tile of the card
 * color, a short centered headline, one highlighted block and a full-width
 * action in the card color with contrast-safe text. Table layout and inline
 * styles only, so it renders in Gmail, Outlook and Apple Mail.
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

/** Design-system tokens (docs/DESIGN_SYSTEM.md, --enterprise-*). */
const TOKENS = {
  canvas: "#F5F7F8",
  surface: "#FFFFFF",
  subtle: "#F9FAFB",
  text: "#111827",
  muted: "#667085",
  border: "#E4E7EC",
  font: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
} as const;

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

/** Up to two initials for the logo tile when the card has no logo. */
export function monogram(tenantName: string) {
  const words = clean(tenantName).split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word));
  const initials = words.slice(0, 2).map((word) => Array.from(word.replace(/^[^\p{L}\p{N}]+/u, ""))[0] ?? "");
  return initials.join("").toUpperCase() || "•";
}

type Highlight = { label: string; values: string[] };

function brandTile(brand: EmailBrand, color: string, textColor: string) {
  const tenant = escapeHtml(clean(brand.tenantName));
  const logo = safeHttpsUrl(brand.logoUrl);
  const content = logo
    ? `<img src="${escapeHtml(logo)}" alt="${tenant}" width="56" style="display:block;width:56px;max-width:56px;height:auto;max-height:56px;margin:0 auto;border:0;outline:none;">`
    : `<span style="font-size:22px;line-height:56px;font-weight:600;letter-spacing:0.02em;color:${textColor};">${escapeHtml(monogram(brand.tenantName))}</span>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td align="center" valign="middle" width="80" height="80" bgcolor="${color}" style="width:80px;height:80px;padding:12px;box-sizing:border-box;border-radius:12px;background:${color};">${content}</td></tr></table>`;
}

function highlightBlock(highlight: Highlight) {
  const values = highlight.values
    .map((value, index) => `<p style="margin:${index === 0 ? "6px" : "4px"} 0 0;font-size:17px;line-height:1.4;font-weight:600;color:${TOKENS.text};">${escapeHtml(value)}</p>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr><td align="center" bgcolor="${TOKENS.subtle}" style="padding:20px;border:1px solid ${TOKENS.border};border-radius:8px;background:${TOKENS.subtle};"><p style="margin:0;font-size:11px;line-height:1.4;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${TOKENS.muted};">${escapeHtml(highlight.label)}</p>${values}</td></tr></table>`;
}

function layout(input: {
  brand: EmailBrand;
  preheader: string;
  title: string;
  lead: string;
  highlight: Highlight | null;
  note: string | null;
  ctaLabel: string;
  ctaUrl: string;
  finePrint: string;
  footerText: string;
}) {
  const color = safeColor(input.brand.backgroundColor);
  const textColor = readableTextColor(color);
  const tenant = escapeHtml(clean(input.brand.tenantName));
  const ctaUrl = safeHttpsUrl(input.ctaUrl);
  const button = ctaUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;"><tr><td align="center" bgcolor="${color}" style="border-radius:8px;background:${color};"><a href="${escapeHtml(ctaUrl)}" style="display:block;padding:14px 20px;font-family:${TOKENS.font};font-size:15px;line-height:20px;font-weight:600;color:${textColor};text-decoration:none;border-radius:8px;">${escapeHtml(input.ctaLabel)}</a></td></tr></table>`
    : "";
  const note = input.note
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${TOKENS.muted};text-align:center;">${escapeHtml(input.note)}</p>`
    : "";
  const attribution = input.brand.showMorrowAttribution
    ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:${TOKENS.muted};">Powered by <strong>morrow</strong></p>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${tenant}</title>
</head>
<body style="margin:0;padding:0;background:${TOKENS.canvas};font-family:${TOKENS.font};color:${TOKENS.text};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TOKENS.canvas}" style="background:${TOKENS.canvas};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td bgcolor="${TOKENS.surface}" style="padding:40px 32px;background:${TOKENS.surface};border:1px solid ${TOKENS.border};border-radius:12px;font-family:${TOKENS.font};">
${brandTile(input.brand, color, textColor)}
<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${TOKENS.muted};text-align:center;">${tenant}</p>
<h1 style="margin:4px 0 0;font-size:24px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:${TOKENS.text};text-align:center;">${escapeHtml(input.title)}</h1>
<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:${TOKENS.muted};text-align:center;">${escapeHtml(input.lead)}</p>
${input.highlight ? highlightBlock(input.highlight) : ""}
${note}
${button}
<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${TOKENS.muted};text-align:center;">${escapeHtml(input.finePrint)}</p>
</td></tr>
<tr><td align="center" style="padding:24px 16px 0;font-family:${TOKENS.font};font-size:12px;line-height:1.5;color:${TOKENS.muted};text-align:center;">
<p style="margin:0;">${escapeHtml(input.footerText)}</p>
${attribution}
</td></tr>
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

  const text = [greeting, "", intro, rewardLine ? `\n${rewardLine}` : "", nextLine ?? "", "", walletLine, `Abrir mi tarjeta: ${input.cardUrl}`, "", footer(tenantName)]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");

  return {
    subject,
    html: layout({
      brand: input.brand,
      preheader: rewardLine ?? intro,
      title: "Tu tarjeta está lista",
      lead: `${greeting} ${intro.charAt(0).toLowerCase()}${intro.slice(1)}`,
      highlight: welcomeReward ? { label: "Regalo de bienvenida", values: [welcomeReward] } : null,
      note: [welcomeReward ? "Muéstralo en caja para canjearlo." : null, nextLine].filter(Boolean).join(" ") || null,
      ctaLabel: "Abrir mi tarjeta",
      ctaUrl: input.cardUrl,
      finePrint: "Agrégala a Apple Wallet o Google Wallet desde tu tarjeta.",
      footerText: footer(tenantName),
    }),
    text,
  };
}

/** morrow-branded account email (no tenant branding, no attribution line). */
const MORROW_BRAND: EmailBrand = {
  tenantName: "morrow",
  logoUrl: null,
  backgroundColor: "#149C91",
  showMorrowAttribution: false,
};

export function renderPasswordRecoveryEmail(input: { fullName: string; resetUrl: string }): RenderedEmail {
  const name = firstName(input.fullName);
  const greeting = name ? `Hola ${name},` : "Hola,";
  const lead = `${greeting} recibimos una solicitud para restablecer la contraseña de tu cuenta de administrador en morrow.`;
  const expiry = "El enlace caduca en 1 hora y solo funciona una vez.";
  const ignore = "Si no lo solicitaste, ignora este correo: tu contraseña actual seguirá funcionando.";

  return {
    subject: "Restablece tu contraseña de morrow",
    html: layout({
      brand: MORROW_BRAND,
      preheader: "Crea una nueva contraseña para tu cuenta de administrador.",
      title: "Restablece tu contraseña",
      lead,
      highlight: null,
      note: null,
      ctaLabel: "Crear nueva contraseña",
      ctaUrl: input.resetUrl,
      finePrint: expiry,
      footerText: ignore,
    }),
    text: [greeting, "", "Recibimos una solicitud para restablecer la contraseña de tu cuenta de administrador en morrow.", "", `Crear nueva contraseña: ${input.resetUrl}`, "", expiry, ignore].join("\n"),
  };
}

export function renderRewardEmail(input: RewardEmailInput): RenderedEmail {
  const tenantName = clean(input.brand.tenantName);
  const name = firstName(input.customerName);
  const greeting = name ? `Hola ${name},` : "Hola,";
  const names = input.rewardNames.map(clean).filter(Boolean);
  const count = names.length || 1;
  const rewards = listNames(input.rewardNames);
  const subject = count === 1
    ? `¡Ganaste ${rewards} en ${tenantName}!`
    : `¡Ganaste ${count} premios en ${tenantName}!`;
  const congrats = `¡Felicidades! Con tu última compra en ${tenantName} ganaste: ${rewards}.`;
  const howTo = count === 1
    ? "Muéstralo en caja para canjearlo. También lo verás en tu tarjeta."
    : "Muéstralos en caja para canjearlos. También los verás en tu tarjeta.";

  return {
    subject,
    html: layout({
      brand: input.brand,
      preheader: congrats,
      title: count === 1 ? "Ganaste un premio" : `Ganaste ${count} premios`,
      lead: `${greeting} con tu última compra en ${tenantName} desbloqueaste:`,
      highlight: { label: count === 1 ? "Tu premio" : "Tus premios", values: names.length ? names : ["Un premio"] },
      note: null,
      ctaLabel: "Ver mi tarjeta",
      ctaUrl: input.cardUrl,
      finePrint: howTo,
      footerText: footer(tenantName),
    }),
    text: [greeting, "", congrats, howTo, "", `Ver mi tarjeta: ${input.cardUrl}`, "", footer(tenantName)].join("\n"),
  };
}
