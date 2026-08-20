import QRCode from "qrcode";

const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,256}$/;

export function isCustomerCardToken(value: string) {
  return CARD_TOKEN_PATTERN.test(value);
}

export function customerCardClaimPath(cardToken: string) {
  if (!isCustomerCardToken(cardToken)) {
    throw new Error("Invalid customer card token.");
  }
  return `/card/${encodeURIComponent(cardToken)}?claim=1`;
}

export function customerCardClaimUrl(origin: string, cardToken: string) {
  if (!isCustomerCardToken(cardToken)) {
    throw new Error("Invalid customer card token.");
  }
  const parsedOrigin = new URL(origin);
  if (
    !["http:", "https:"].includes(parsedOrigin.protocol)
    || parsedOrigin.username
    || parsedOrigin.password
    || parsedOrigin.pathname !== "/"
    || parsedOrigin.search
    || parsedOrigin.hash
  ) {
    throw new Error("Invalid card claim origin.");
  }
  return `${parsedOrigin.origin}${customerCardClaimPath(cardToken)}`;
}

export async function createCustomerCardClaimQrDataUrl(origin: string, cardToken: string) {
  return QRCode.toDataURL(customerCardClaimUrl(origin, cardToken), {
    color: { dark: "#111827", light: "#ffffff" },
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}

export async function createCustomerCardQrDataUrl(cardToken: string) {
  if (!isCustomerCardToken(cardToken)) {
    throw new Error("Invalid customer card token.");
  }

  return QRCode.toDataURL(cardToken, {
    color: { dark: "#111827", light: "#ffffff" },
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}
