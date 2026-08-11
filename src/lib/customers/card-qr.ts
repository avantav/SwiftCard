import QRCode from "qrcode";

const CARD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,256}$/;

export async function createCustomerCardQrDataUrl(cardToken: string) {
  if (!CARD_TOKEN_PATTERN.test(cardToken)) {
    throw new Error("Invalid customer card token.");
  }

  return QRCode.toDataURL(cardToken, {
    color: { dark: "#111827", light: "#ffffff" },
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}
