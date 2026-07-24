const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,}$/;

export function parseCardQrPayload(payload: string): { ok: true; cardToken: string } | { ok: false; error: string } {
  const value = payload.trim();
  if (!value) return { ok: false, error: "El QR está vacío." };

  let token = value;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/card\/([^/]+)$/);
    if (!match) return { ok: false, error: "El QR no contiene una tarjeta SwiftWallet." };
    token = match[1];
  } catch {
    // Raw tokens are supported for scanner integrations that omit the URL.
  }

  if (!TOKEN_PATTERN.test(token)) return { ok: false, error: "El token de tarjeta no es válido." };
  return { ok: true, cardToken: token };
}
