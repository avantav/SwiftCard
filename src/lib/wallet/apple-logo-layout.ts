const APPLE_LOGO_MAX_WIDTH = 160;
const APPLE_LOGO_MAX_HEIGHT = 50;

export function appleWalletLogoDimensions(sourceWidth: number, sourceHeight: number) {
  if (
    !Number.isFinite(sourceWidth)
    || !Number.isFinite(sourceHeight)
    || sourceWidth <= 0
    || sourceHeight <= 0
  ) {
    throw new Error("Apple Wallet logo dimensions must be positive.");
  }

  const scale = Math.min(
    APPLE_LOGO_MAX_WIDTH / sourceWidth,
    APPLE_LOGO_MAX_HEIGHT / sourceHeight,
  );

  return {
    width: Math.max(1, Math.min(APPLE_LOGO_MAX_WIDTH, Math.round(sourceWidth * scale))),
    height: Math.max(1, Math.min(APPLE_LOGO_MAX_HEIGHT, Math.round(sourceHeight * scale))),
  };
}
