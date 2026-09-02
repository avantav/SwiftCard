import { AppleWalletAddButton } from "@/components/apple-wallet-add-button";
import { GoogleWalletAddButton } from "@/components/google-wallet-add-button";

export function PublicRegistrationSuccess({
  appleWalletAvailable,
  googleWalletAvailable,
  cardToken,
}: {
  appleWalletAvailable: boolean;
  googleWalletAvailable: boolean;
  cardToken: string;
}) {
  return (
    <div className="public-success-state" role="status">
      <span aria-hidden="true">✓</span>
      <h2>Registro completado</h2>
      <p>Agrega tu tarjeta a la billetera de tu teléfono.</p>
      {appleWalletAvailable || googleWalletAvailable ? (
        <div className="public-wallet-actions">
          {appleWalletAvailable ? <AppleWalletAddButton cardToken={cardToken} /> : null}
          {googleWalletAvailable ? <GoogleWalletAddButton cardToken={cardToken} /> : null}
        </div>
      ) : (
        <p className="public-wallet-unavailable">
          La billetera móvil no está disponible temporalmente. Solicita ayuda al
          negocio.
        </p>
      )}
    </div>
  );
}
