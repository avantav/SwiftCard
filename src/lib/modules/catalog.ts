/**
 * Catalog of tenant modules (DEC-0072, docs/MODULES.md).
 *
 * MODULE: a feature that is sold in packages and evaluated per tenant.
 * SWITCH: an internal part of a module that can be stopped on its own; its key
 * is "<module>.<part>" and it is only active when its module is active.
 *
 * Only keys declared here can be configured from the Superadmin. A module is
 * OFF until the Superadmin turns it on, so declaring one changes nothing.
 */
export type ModuleKind = "MODULE" | "SWITCH";
export type ModuleAvailability = "AVAILABLE" | "IN_DEVELOPMENT";

export type ModuleCatalogEntry = {
  key: string;
  kind: ModuleKind;
  parent?: string;
  name: string;
  description: string;
  /** What tenants lose while it is inactive. */
  inactiveEffect: string;
  availability: ModuleAvailability;
  addedIn: string;
};

export const MODULE_CATALOG: readonly ModuleCatalogEntry[] = [
  {
    key: "swiftpos_integration",
    kind: "MODULE",
    name: "Integración SwiftPOS",
    description: "Las ventas de SwiftPOS acumulan sellos y puntos en la tarjeta del cliente.",
    inactiveEffect: "SwiftPOS no puede identificar tarjetas ni enviar compras; todo lo demás funciona igual.",
    availability: "AVAILABLE",
    addedIn: "DEC-0071"
  },
  {
    key: "swiftpos_integration.card_resolve",
    kind: "SWITCH",
    parent: "swiftpos_integration",
    name: "Identificar tarjetas desde SwiftPOS",
    description: "La caja escanea el QR de la tarjeta para identificar al cliente.",
    inactiveEffect: "La caja cobra sin tarjeta.",
    availability: "AVAILABLE",
    addedIn: "DEC-0071"
  },
  {
    key: "swiftpos_integration.purchases",
    kind: "SWITCH",
    parent: "swiftpos_integration",
    name: "Recibir compras de SwiftPOS",
    description: "Registra las compras que envía SwiftPOS.",
    inactiveEffect: "Las compras no se registran; SwiftPOS las reintenta al reactivarse.",
    availability: "AVAILABLE",
    addedIn: "DEC-0071"
  },
  {
    key: "swiftpos_integration.wallet_refresh",
    kind: "SWITCH",
    parent: "swiftpos_integration",
    name: "Avisar al cliente tras compras de SwiftPOS",
    description: "Actualiza Apple y Google Wallet y envía los correos de recompensa al registrar la compra.",
    inactiveEffect: "La compra se registra; Wallet se actualiza en la siguiente actualización y no se envían correos por esa compra.",
    availability: "AVAILABLE",
    addedIn: "DEC-0071"
  },
  {
    key: "swiftpos_integration.location_validation",
    kind: "SWITCH",
    parent: "swiftpos_integration",
    name: "Validar ubicación de SwiftPOS",
    description: "Comprueba con la geocerca la ubicación que envía SwiftPOS.",
    inactiveEffect: "Se ignora la ubicación enviada por SwiftPOS.",
    availability: "AVAILABLE",
    addedIn: "DEC-0071"
  }
];

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,48}(\.[a-z][a-z0-9_]{1,48})?$/;

export function isValidModuleKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function getModuleEntry(key: string): ModuleCatalogEntry | undefined {
  return MODULE_CATALOG.find((entry) => entry.key === key);
}

export function catalogKeys(): string[] {
  return MODULE_CATALOG.map((entry) => entry.key);
}

/** Modules that can be sold in a package (switches are never sold). */
export function sellableModules(): ModuleCatalogEntry[] {
  return MODULE_CATALOG.filter((entry) => entry.kind === "MODULE");
}

export function switchesOf(moduleKey: string): ModuleCatalogEntry[] {
  return MODULE_CATALOG.filter((entry) => entry.kind === "SWITCH" && entry.parent === moduleKey);
}

/** Modules followed by their switches, in catalog order, for tables. */
export function catalogInDisplayOrder(): ModuleCatalogEntry[] {
  return sellableModules().flatMap((module) => [module, ...switchesOf(module.key)]);
}
