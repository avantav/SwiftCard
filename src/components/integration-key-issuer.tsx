"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { IssueKeyState } from "@/app/superadmin/tenants/[tenantId]/integrations/swiftpos/actions";

type Props = {
  tenantId: string;
  action: (state: IssueKeyState, formData: FormData) => Promise<IssueKeyState>;
};

/** Shows a newly issued API key exactly once; it is never stored in readable form. */
export function IntegrationKeyIssuer({ tenantId, action }: Props) {
  const [state, formAction] = useActionState(action, {});
  return (
    <>
      {state.error ? <p className="enterprise-alert is-error" role="alert">{state.error}</p> : null}
      {state.key ? (
        <div className="enterprise-alert is-success" role="status">
          <strong>Llave emitida ({state.prefix}).</strong> Cópiala ahora y guárdala en SwiftPOS: no se volverá a mostrar.
          <label className="field">
            <span>API key</span>
            <input readOnly value={state.key} onFocus={(event) => event.currentTarget.select()} aria-describedby="integration-key-help" />
          </label>
          <small id="integration-key-help">Selecciona el campo y cópialo. Si se pierde, revoca esta llave y emite otra.</small>
        </div>
      ) : null}
      <form action={formAction} className="auth-form">
        <input type="hidden" name="tenantId" value={tenantId} />
        <label className="field">
          <span>Motivo</span>
          <input name="reason" required minLength={3} maxLength={500} />
        </label>
        <SubmitButton className="primary-button">Emitir API key</SubmitButton>
      </form>
    </>
  );
}
