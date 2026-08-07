import { AppleWalletAddButton } from "@/components/apple-wallet-add-button";

export function PublicRegistrationSuccess({
  appleWalletAvailable,
  cardToken,
}: {
  appleWalletAvailable: boolean;
  cardToken: string;
}) {
  return (
    <div className="public-success-state" role="status">
      <span aria-hidden="true">✓</span>
      <h2>Registro completado</h2>
      <p>Agrega tu tarjeta a Apple Wallet para llevarla en tu iPhone.</p>
      {appleWalletAvailable ? (
        <AppleWalletAddButton cardToken={cardToken} />
      ) : (
        <p className="public-wallet-unavailable">
          Apple Wallet no está disponible temporalmente. Solicita ayuda al
          negocio.
        </p>
      )}
    </div>
  );
}
