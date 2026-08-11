import { normalizePhone } from "@/lib/customers/phone";

export const ADMIN_CUSTOMER_PAGE_SIZE = 50;

export type AdminCustomerDirectoryParams = {
  page?: string;
  q?: string;
  status?: string;
};

export function parseAdminCustomerDirectoryParams(
  params: AdminCustomerDirectoryParams,
) {
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const status =
    params.status === "ACTIVE" || params.status === "INACTIVE"
      ? params.status
      : "ALL";

  return {
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    search: (params.q ?? "").trim().slice(0, 80),
    status,
  } as const;
}

export function resolveAdminCustomerSearch(search: string) {
  if (!search) return null;
  const phone = normalizePhone(search);
  return phone.ok
    ? ({ kind: "PHONE", value: phone.value } as const)
    : ({ kind: "NAME", value: search } as const);
}

export function adminCustomerPageHref(input: {
  page: number;
  search: string;
  status: "ACTIVE" | "INACTIVE" | "ALL";
}) {
  const params = new URLSearchParams();
  if (input.search) params.set("q", input.search);
  if (input.status !== "ALL") params.set("status", input.status);
  if (input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}
