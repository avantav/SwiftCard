export type AppleWalletDesignInput = {
  appleEnabled: boolean;
  logoText: string;
  description: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  logoImageUrl: string | null;
  stripImageUrl: string | null;
  notificationIconUrl: string | null;
  logoScalePercent: number;
  logoMarginXPercent: number;
  logoMarginYPercent: number;
  stripScalePercent: number;
  stripMarginXPercent: number;
  stripMarginYPercent: number;
};

export type AppleWalletDesignValidation =
  | { ok: true; data: AppleWalletDesignInput }
  | { ok: false; errors: string[] };

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalHttpsUrl(
  formData: FormData,
  key: string,
  label: string,
  errors: string[],
) {
  const value = textValue(formData, key);
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("invalid URL");
    }
    return url.toString();
  } catch {
    errors.push(`${label} debe ser una URL HTTPS válida.`);
    return null;
  }
}

function colorValue(
  formData: FormData,
  key: string,
  label: string,
  errors: string[],
) {
  const value = textValue(formData, key).toUpperCase();
  if (!HEX_COLOR.test(value)) errors.push(`${label} no es válido.`);
  return value;
}

function integerValue(
  formData: FormData,
  key: string,
  label: string,
  minimum: number,
  maximum: number,
  fallback: number,
  errors: string[],
) {
  const raw = textValue(formData, key);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < minimum || value > maximum) {
    errors.push(`${label} debe estar entre ${minimum} y ${maximum}.`);
  }
  return value;
}

function linearColorPart(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function colorContrastRatio(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = [
      Number.parseInt(color.slice(1, 3), 16),
      Number.parseInt(color.slice(3, 5), 16),
      Number.parseInt(color.slice(5, 7), 16),
    ];
    return (
      0.2126 * linearColorPart(channels[0]) +
      0.7152 * linearColorPart(channels[1]) +
      0.0722 * linearColorPart(channels[2])
    );
  };
  const left = luminance(first);
  const right = luminance(second);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

export function validateAppleWalletDesignForm(
  formData: FormData,
): AppleWalletDesignValidation {
  const errors: string[] = [];
  const logoText = textValue(formData, "logoText");
  const description = textValue(formData, "description");
  const backgroundColor = colorValue(
    formData,
    "backgroundColor",
    "El color de fondo",
    errors,
  );
  const foregroundColor = colorValue(
    formData,
    "foregroundColor",
    "El color de texto",
    errors,
  );
  const labelColor = colorValue(
    formData,
    "labelColor",
    "El color de etiquetas",
    errors,
  );

  if (logoText.length < 1 || logoText.length > 60) {
    errors.push("El texto del logo debe tener entre 1 y 60 caracteres.");
  }
  if (description.length < 1 || description.length > 120) {
    errors.push("La descripción debe tener entre 1 y 120 caracteres.");
  }

  if (
    HEX_COLOR.test(backgroundColor) &&
    HEX_COLOR.test(foregroundColor) &&
    colorContrastRatio(backgroundColor, foregroundColor) < 4.5
  ) {
    errors.push("El texto debe tener contraste mínimo de 4.5:1 con el fondo.");
  }
  if (
    HEX_COLOR.test(backgroundColor) &&
    HEX_COLOR.test(labelColor) &&
    colorContrastRatio(backgroundColor, labelColor) < 4.5
  ) {
    errors.push("Las etiquetas deben tener contraste mínimo de 4.5:1 con el fondo.");
  }

  const logoImageUrl = optionalHttpsUrl(
    formData,
    "logoImageUrl",
    "El logo",
    errors,
  );
  const stripImageUrl = optionalHttpsUrl(
    formData,
    "stripImageUrl",
    "La imagen principal",
    errors,
  );
  const notificationIconUrl = optionalHttpsUrl(
    formData,
    "notificationIconUrl",
    "El logo de notificaciones",
    errors,
  );
  const logoScalePercent = integerValue(formData, "logoScalePercent", "El tamaño del logo", 50, 100, 100, errors);
  const logoMarginXPercent = integerValue(formData, "logoMarginXPercent", "El margen horizontal del logo", 0, 20, 0, errors);
  const logoMarginYPercent = integerValue(formData, "logoMarginYPercent", "El margen vertical del logo", 0, 20, 0, errors);
  const stripScalePercent = integerValue(formData, "stripScalePercent", "El tamaño de la imagen principal", 50, 150, 100, errors);
  const stripMarginXPercent = integerValue(formData, "stripMarginXPercent", "El margen horizontal de la imagen principal", 0, 20, 0, errors);
  const stripMarginYPercent = integerValue(formData, "stripMarginYPercent", "El margen vertical de la imagen principal", 0, 20, 0, errors);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      appleEnabled: formData.get("appleEnabled") === "on",
      logoText,
      description,
      backgroundColor,
      foregroundColor,
      labelColor,
      logoImageUrl,
      stripImageUrl,
      notificationIconUrl,
      logoScalePercent,
      logoMarginXPercent,
      logoMarginYPercent,
      stripScalePercent,
      stripMarginXPercent,
      stripMarginYPercent,
    },
  };
}

export function hexToAppleRgb(color: string) {
  if (!HEX_COLOR.test(color)) throw new Error("Invalid Apple Wallet color.");
  return `rgb(${Number.parseInt(color.slice(1, 3), 16)}, ${Number.parseInt(color.slice(3, 5), 16)}, ${Number.parseInt(color.slice(5, 7), 16)})`;
}
