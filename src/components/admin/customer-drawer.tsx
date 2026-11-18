import Link from "next/link";
import { adjustCustomerStamps, applyCorrection, updateCustomerProfileFromAdmin } from "@/app/admin/customers/correction-actions";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { AdjustStampsForm, CorrectionConfirmForm, CustomerProfileForm } from "@/components/admin/customer-correction-forms";
import { WorkspaceDialog, WorkspaceDialogHeader } from "@/components/admin/workspace-dialog";
import {
  CORRECTION_LABELS,
  canAdjustStamps,
  correctionConsequence,
  correctionFor,
  type ActivityItem,
  type CorrectionKind,
} from "@/lib/admin/customer-activity";
import type { CustomerActivity } from "@/lib/admin/customer-activity-server";

export const CUSTOMER_TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "historial", label: "Historial" },
  { id: "ajustar", label: "Ajustar saldo" },
  { id: "editar", label: "Editar" },
] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number]["id"];

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  CONFIRMED: { label: "Confirmada", tone: "is-active" },
  CANCELLED: { label: "Cancelada", tone: "is-neutral" },
  COMPLETED: { label: "Canjeado", tone: "is-active" },
  REVERSED: { label: "Revertido", tone: "is-neutral" },
  AVAILABLE: { label: "Disponible", tone: "is-active" },
  REDEEMED: { label: "Canjeado", tone: "is-neutral" },
  EXPIRED: { label: "Vencido", tone: "is-suspended" },
};

function describe(item: ActivityItem, money: (minor: number) => string, unitPlural: string) {
  switch (item.kind) {
    case "purchase": return { title: `Compra ${item.ticket} · ${money(item.amountMinor)}`, detail: `${item.branch} · +${item.units} ${unitPlural}` };
    case "redemption": return { title: `Canje de «${item.reward}»`, detail: item.branch };
    case "reward": return { title: `Premio «${item.reward}»`, detail: item.expiresAt ? `Vence ${new Date(item.expiresAt).toLocaleDateString("es-MX")}` : "Sin vencimiento" };
    case "adjustment": return { title: `Ajuste ${item.delta > 0 ? "+" : ""}${item.delta} ${unitPlural}`, detail: `${item.branch} · ${item.note}` };
  }
}

/**
 * Customer workspace for the Admin general (DEC-0074): summary, history with
 * one contextual correction per movement, stamp adjustment and profile edit.
 * Corrections are offered only when the program allows them; the database
 * enforces the same rules (RPCs and migration 0081).
 */
export function CustomerDrawer({ activity, tab, act, closeHref, keep, currency, readOnly }: {
  activity: CustomerActivity;
  tab: CustomerTab;
  act: string | undefined;
  closeHref: string;
  keep: Record<string, string | undefined>;
  currency: string;
  readOnly: boolean;
}) {
  const { customer, program } = activity;
  const moneyFormat = new Intl.NumberFormat("es-MX", { style: "currency", currency });
  const money = (minor: number) => moneyFormat.format(minor / 100);
  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });
  const unitPlural = program?.unitPlural ?? "sellos";
  const base = { ...keep, customer: customer.id };
  const tabHref = (extra: Record<string, string>) => `/admin/customers?${new URLSearchParams(Object.entries({ ...base, ...extra }).filter((entry): entry is [string, string] => Boolean(entry[1])))}`;
  const [actKind, actId] = (act ?? "").split(":") as [CorrectionKind | "", string | undefined];
  const pending = !readOnly && actKind && actId ? activity.items.find((item) => item.id === actId && correctionFor(item, program) === actKind) ?? null : null;
  const tabs = readOnly ? CUSTOMER_TABS.filter((item) => item.id === "resumen" || item.id === "historial") : CUSTOMER_TABS;

  return <WorkspaceDialog closeHref={closeHref} labelledBy="customer-drawer-title" size="lg">
    <div className="enterprise-data-panel branch-workspace-panel customer-drawer">
      <WorkspaceDialogHeader closeHref={closeHref} description={`${customer.phone}${customer.email ? ` · ${customer.email}` : ""}`} eyebrow={activity.cardName ?? "Sin tarjeta activa"} title={customer.fullName} titleId="customer-drawer-title" />
      <AdminTabs active={tab} baseHref="/admin/customers" keep={base} label={`Secciones de ${customer.fullName}`} param="ctab" tabs={tabs} />
      <div className="branch-workspace-body customer-drawer-body">
        {tab === "resumen" ? <dl className="staff-summary-list">
          <div><dt>Estado</dt><dd><span className={`enterprise-badge ${customer.status === "ACTIVE" ? "is-active" : "is-neutral"}`}>{customer.status === "ACTIVE" ? "Activo" : "Inactivo"}</span></dd></div>
          <div><dt>Saldo</dt><dd>{program?.programType === "LIFETIME_POINTS" ? `${activity.balance.lifetimePoints.toFixed(1)} puntos` : `${activity.balance.stamps} ${unitPlural}`}</dd></div>
          <div><dt>Movimientos recientes</dt><dd>{activity.items.length}</dd></div>
          <div><dt>Cliente desde</dt><dd>{date.format(new Date(customer.createdAt))}</dd></div>
        </dl> : null}

        {tab === "historial" ? <>
          {pending && program ? <CorrectionConfirmForm
            action={applyCorrection.bind(null, customer.id, actKind as CorrectionKind, pending.id)}
            cancelHref={tabHref({ ctab: "historial" })}
            consequence={correctionConsequence(actKind as CorrectionKind, pending, program, money)}
            submitLabel={`Confirmar: ${CORRECTION_LABELS[actKind as CorrectionKind].toLowerCase()}`}
            title={CORRECTION_LABELS[actKind as CorrectionKind]}
          /> : null}
          {activity.items.length ? <ul className="customer-activity-list">
            {activity.items.map((item) => {
              const text = describe(item, money, unitPlural);
              const correction = readOnly ? null : correctionFor(item, program);
              const status = "status" in item ? STATUS_LABELS[item.status] : null;
              return <li className={pending?.id === item.id ? "is-selected" : undefined} key={`${item.kind}-${item.id}`}>
                <div><strong>{text.title}</strong><small>{date.format(new Date(item.at))} · {text.detail}{"note" in item && item.note && item.kind !== "adjustment" ? ` · Motivo: ${item.note}` : ""}</small></div>
                <div className="customer-activity-meta">
                  {status ? <span className={`enterprise-badge ${status.tone}`}>{status.label}</span> : null}
                  {correction ? <Link className="enterprise-secondary-action" href={tabHref({ ctab: "historial", act: `${correction}:${item.id}` })} replace scroll={false}>{CORRECTION_LABELS[correction]}</Link> : null}
                </div>
              </li>;
            })}
          </ul> : <div className="enterprise-empty-state admin-compact-empty"><h3>Sin movimientos</h3><p>Las compras, canjes y premios del cliente aparecerán aquí.</p></div>}
          {program?.programType === "LIFETIME_POINTS" ? <p className="field-hint">Los puntos acumulativos son definitivos: solo se pueden revertir canjes.</p> : null}
        </> : null}

        {tab === "ajustar" && !readOnly ? canAdjustStamps(program) && activity.branches.length
          ? <AdjustStampsForm action={adjustCustomerStamps.bind(null, customer.id)} branches={activity.branches} unitPlural={unitPlural} />
          : <p className="enterprise-alert is-info" role="status">{program ? "Los puntos acumulativos no admiten ajustes manuales." : "El cliente no tiene una tarjeta activa para ajustar."}</p>
          : null}

        {tab === "editar" && !readOnly ? <CustomerProfileForm action={updateCustomerProfileFromAdmin.bind(null, customer.id)} initial={{ fullName: customer.fullName, phone: customer.phone, email: customer.email ?? "", birthDate: customer.birthDate ?? "", status: customer.status }} /> : null}
      </div>
    </div>
  </WorkspaceDialog>;
}
