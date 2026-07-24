import { NextResponse } from "next/server";
import { requireInternalArea } from "@/lib/auth/server";

const exportTypes = ["customers", "purchases", "rewards", "redemptions", "adjustments", "summary"] as const;
type ExportType = (typeof exportTypes)[number];

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [columns, ...rows.map((row) => columns.map((column) => csvValue(row[column])))]
    .map((row) => row.join(","))
    .join("\r\n") + "\r\n";
}

export async function GET(request: Request) {
  const context = await requireInternalArea("ADMIN");
  const url = new URL(request.url);
  const type = url.searchParams.get("type") as ExportType | null;
  if (!type || !exportTypes.includes(type)) return NextResponse.json({ error: "Tipo de exportación inválido." }, { status: 400 });
  const branchId = url.searchParams.get("branchId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  let rows: Array<Record<string, unknown>> = [];
  let columns: string[] = [];

  if (type === "customers") {
    let query = context.supabase.from("customers").select("full_name,normalized_phone,email,status,registration_method,source_branch_id,created_at").order("created_at");
    if (branchId) query = query.eq("source_branch_id", branchId);
    if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
    if (to) query = query.lt("created_at", `${to}T00:00:00Z`);
    const response = await query;
    rows = (response.data ?? []) as Array<Record<string, unknown>>;
    columns = ["full_name", "normalized_phone", "email", "status", "registration_method", "source_branch_id", "created_at"];
  } else if (type === "purchases") {
    let query = context.supabase.from("purchases").select("ticket_number,amount_minor,stamps_awarded,status,branch_id,staff_profile_id,created_at").order("created_at");
    if (branchId) query = query.eq("branch_id", branchId);
    if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
    if (to) query = query.lt("created_at", `${to}T00:00:00Z`);
    const response = await query;
    rows = (response.data ?? []) as Array<Record<string, unknown>>;
    columns = ["ticket_number", "amount_minor", "stamps_awarded", "status", "branch_id", "staff_profile_id", "created_at"];
  } else if (type === "rewards") {
    const response = await context.supabase.from("rewards").select("name,description,status,customer_id,program_id,created_at,expires_at").order("created_at");
    rows = (response.data ?? []) as Array<Record<string, unknown>>;
    columns = ["name", "description", "status", "customer_id", "program_id", "created_at", "expires_at"];
  } else if (type === "redemptions") {
    let query = context.supabase.from("reward_redemptions").select("reward_id,customer_id,branch_id,staff_profile_id,status,redeemed_at,reversed_at").order("redeemed_at");
    if (branchId) query = query.eq("branch_id", branchId);
    const response = await query;
    rows = (response.data ?? []) as Array<Record<string, unknown>>;
    columns = ["reward_id", "customer_id", "branch_id", "staff_profile_id", "status", "redeemed_at", "reversed_at"];
  } else if (type === "adjustments") {
    let query = context.supabase.from("stamp_adjustments").select("customer_id,branch_id,staff_profile_id,stamps_delta,reason,created_at").order("created_at");
    if (branchId) query = query.eq("branch_id", branchId);
    const response = await query;
    rows = (response.data ?? []) as Array<Record<string, unknown>>;
    columns = ["customer_id", "branch_id", "staff_profile_id", "stamps_delta", "reason", "created_at"];
  } else {
    const response = await context.supabase.rpc("get_dashboard_metrics", { target_branch_id: branchId || null, from_date: from ? `${from}T00:00:00Z` : null, to_date: to ? `${to}T00:00:00Z` : null });
    rows = (response.data ?? []) as Array<Record<string, unknown>>;
    columns = ["customer_count", "new_customer_count", "purchase_count", "purchase_amount_minor", "stamps_awarded", "rewards_generated", "rewards_redeemed"];
  }

  return new NextResponse(csv(rows, columns), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="swiftwallet-${type}.csv"`
    }
  });
}
