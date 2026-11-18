/**
 * Success notices shown as toasts in the admin (DEC-0073). The URL only ever
 * carries a known code (`?notice=branch_created`); free text from the URL is
 * never rendered.
 */
export const NOTICES = {
  saved: "Cambios guardados.",
  branch_created: "Sucursal creada.",
  branch_updated: "Sucursal actualizada.",
  branch_access_saved: "Acceso de empleados actualizado.",
  geofence_saved: "Política de ubicación actualizada.",
  staff_created: "Persona agregada al equipo.",
  staff_updated: "Cuenta actualizada.",
  pin_operator_created: "Operador con PIN creado.",
  card_created: "Borrador de tarjeta creado.",
  card_saved: "Tarjeta guardada.",
  card_published: "Tarjeta publicada.",
  campaign_created: "Campaña creada.",
  customer_updated: "Cliente actualizado.",
  correction_saved: "Corrección registrada.",
  legal_saved: "Datos legales guardados.",
} as const;

export type NoticeCode = keyof typeof NOTICES;

export const NOTICE_PARAM = "notice";

export function isNoticeCode(value: unknown): value is NoticeCode {
  return typeof value === "string" && Object.hasOwn(NOTICES, value);
}

export function noticeMessage(value: unknown) {
  return isNoticeCode(value) ? NOTICES[value] : null;
}

/** Adds `?notice=<code>` to an internal href, keeping its query and hash. */
export function withNotice(href: string, code: NoticeCode) {
  const [beforeHash, hash = ""] = href.split("#", 2);
  const [path, query = ""] = beforeHash!.split("?", 2);
  const params = new URLSearchParams(query);
  params.set(NOTICE_PARAM, code);
  return `${path}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

/** The same href without the notice param (used after the toast reads it). */
export function withoutNotice(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.delete(NOTICE_PARAM);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
