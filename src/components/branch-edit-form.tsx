"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { updateBranch } from "@/app/admin/branches/actions";
import { SubmitButton } from "@/components/submit-button";
import type {
  BranchCreateFieldErrors,
  BranchStatus,
  BranchUpdateActionState,
} from "@/lib/admin/branches";

type EditableBranch = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  geofence_radius_meters: number;
  proximity_enabled: boolean;
  proximity_message: string | null;
  status: BranchStatus;
};

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <span className="field-error-message" id={id}>
      {messages.join(" ")}
    </span>
  );
}

function describedBy(hintId: string | null, errorId: string, hasError: boolean) {
  return [hintId, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;
}

function initialState(branch: EditableBranch): BranchUpdateActionState {
  return {
    status: "idle",
    formError: null,
    fieldErrors: {},
    values: {
      name: branch.name,
      address: branch.address ?? "",
      latitude: branch.latitude?.toString() ?? "",
      longitude: branch.longitude?.toString() ?? "",
      geofenceRadiusMeters: branch.geofence_radius_meters.toString(),
      proximityEnabled: branch.proximity_enabled,
      proximityMessage: branch.proximity_message ?? "",
      status: branch.status,
    },
  };
}

export function BranchEditForm({ branch }: { branch: EditableBranch }) {
  const [state, action] = useActionState(updateBranch, initialState(branch));
  const [selectedStatus, setSelectedStatus] = useState<BranchStatus>(branch.status);
  const summaryRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const errors: BranchCreateFieldErrors = state.fieldErrors;
  const fieldMessages = Object.values(errors).flatMap((messages) => messages ?? []);
  const nameErrorId = `${id}-name-error`;
  const addressHintId = `${id}-address-hint`;
  const addressErrorId = `${id}-address-error`;
  const latitudeHintId = `${id}-latitude-hint`;
  const latitudeErrorId = `${id}-latitude-error`;
  const longitudeErrorId = `${id}-longitude-error`;
  const radiusHintId = `${id}-radius-hint`;
  const radiusErrorId = `${id}-radius-error`;
  const proximityHintId = `${id}-proximity-hint`;
  const proximityErrorId = `${id}-proximity-error`;
  const proximityMessageHintId = `${id}-proximity-message-hint`;
  const proximityMessageErrorId = `${id}-proximity-message-error`;
  const statusHintId = `${id}-status-hint`;
  const statusErrorId = `${id}-status-error`;

  useEffect(() => {
    if (state.status === "error") summaryRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="auth-form admin-inline-form" noValidate>
      <input name="branchId" type="hidden" value={branch.id} />

      {state.status === "error" ? (
        <div
          className="enterprise-alert is-error branch-validation-summary"
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
        >
          <strong>No se pudo actualizar la sucursal</strong>
          {state.formError ? <p>{state.formError}</p> : null}
          {fieldMessages.length ? (
            <ul>
              {[...new Set(fieldMessages)].map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <label className="field">
        <span>Nombre</span>
        <input
          aria-describedby={errors.name?.length ? nameErrorId : undefined}
          aria-invalid={Boolean(errors.name?.length)}
          autoComplete="organization"
          defaultValue={state.values.name}
          maxLength={120}
          minLength={2}
          name="name"
          required
        />
        <FieldError id={nameErrorId} messages={errors.name} />
      </label>

      <label className="field">
        <span>Dirección</span>
        <input
          aria-describedby={describedBy(
            addressHintId,
            addressErrorId,
            Boolean(errors.address?.length),
          )}
          aria-invalid={Boolean(errors.address?.length)}
          autoComplete="street-address"
          defaultValue={state.values.address}
          maxLength={300}
          name="address"
        />
        <span className="field-hint" id={addressHintId}>
          Opcional. Máximo 300 caracteres.
        </span>
        <FieldError id={addressErrorId} messages={errors.address} />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Latitud</span>
          <input
            aria-describedby={describedBy(
              latitudeHintId,
              latitudeErrorId,
              Boolean(errors.latitude?.length),
            )}
            aria-invalid={Boolean(errors.latitude?.length)}
            defaultValue={state.values.latitude}
            max={90}
            min={-90}
            name="latitude"
            step="any"
            type="number"
          />
          <span className="field-hint" id={latitudeHintId}>
            Opcional; si la capturas, la longitud también es obligatoria.
          </span>
          <FieldError id={latitudeErrorId} messages={errors.latitude} />
        </label>
        <label className="field">
          <span>Longitud</span>
          <input
            aria-describedby={errors.longitude?.length ? longitudeErrorId : undefined}
            aria-invalid={Boolean(errors.longitude?.length)}
            defaultValue={state.values.longitude}
            max={180}
            min={-180}
            name="longitude"
            step="any"
            type="number"
          />
          <FieldError id={longitudeErrorId} messages={errors.longitude} />
        </label>
      </div>

      <label className="field">
        <span>Radio de geofence (metros)</span>
        <input
          aria-describedby={describedBy(
            radiusHintId,
            radiusErrorId,
            Boolean(errors.geofenceRadiusMeters?.length),
          )}
          aria-invalid={Boolean(errors.geofenceRadiusMeters?.length)}
          defaultValue={state.values.geofenceRadiusMeters}
          max={100000}
          min={1}
          name="geofenceRadiusMeters"
          required
          step={1}
          type="number"
        />
        <span className="field-hint" id={radiusHintId}>
          Número entero entre 1 y 100000 metros.
        </span>
        <FieldError id={radiusErrorId} messages={errors.geofenceRadiusMeters} />
      </label>

      <label className="check-field branch-proximity-field">
        <input
          aria-describedby={describedBy(
            proximityHintId,
            proximityErrorId,
            Boolean(errors.proximityEnabled?.length),
          )}
          aria-invalid={Boolean(errors.proximityEnabled?.length)}
          defaultChecked={state.values.proximityEnabled}
          name="proximityEnabled"
          type="checkbox"
        />
        <span>
          Proximidad habilitada
          <small id={proximityHintId}>
            Requiere coordenadas para generar ubicaciones útiles en Wallet.
          </small>
          <FieldError id={proximityErrorId} messages={errors.proximityEnabled} />
        </span>
      </label>

      <label className="field">
        <span>Mensaje de proximidad</span>
        <textarea
          aria-describedby={describedBy(
            proximityMessageHintId,
            proximityMessageErrorId,
            Boolean(errors.proximityMessage?.length),
          )}
          aria-invalid={Boolean(errors.proximityMessage?.length)}
          defaultValue={state.values.proximityMessage}
          maxLength={500}
          name="proximityMessage"
          rows={3}
        />
        <span className="field-hint" id={proximityMessageHintId}>
          Opcional. Apple Wallet lo muestra al acercarse a esta ubicación.
        </span>
        <FieldError
          id={proximityMessageErrorId}
          messages={errors.proximityMessage}
        />
      </label>

      <label className="field">
        <span>Estado</span>
        <select
          aria-describedby={describedBy(
            statusHintId,
            statusErrorId,
            Boolean(errors.status?.length),
          )}
          aria-invalid={Boolean(errors.status?.length)}
          name="status"
          onChange={(event) => setSelectedStatus(event.target.value as BranchStatus)}
          required
          value={selectedStatus}
        >
          <option value="ACTIVE">Activa</option>
          <option value="INACTIVE">Inactiva</option>
        </select>
        <span className="field-hint" id={statusHintId}>
          Una sucursal inactiva no acepta registros públicos ni operaciones nuevas.
        </span>
        <FieldError id={statusErrorId} messages={errors.status} />
      </label>

      <SubmitButton
        className="secondary-button"
        confirmMessage={
          branch.status === "ACTIVE" && selectedStatus === "INACTIVE"
            ? "Al desactivar la sucursal dejará de aceptar registros públicos y operaciones nuevas. El historial se conservará. ¿Deseas continuar?"
            : undefined
        }
      >
        Guardar cambios
      </SubmitButton>
    </form>
  );
}
