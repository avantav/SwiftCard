// Synchronizes ACTIVE morrow billing packages to Stripe (test or live,
// depending on STRIPE_SECRET_KEY) and ensures the fixed IVA 16% tax rate.
// Run: npm run stripe:sync-catalog   (reads .env.local)
// Safe to re-run: existing Stripe IDs are reused and creation is idempotent.
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY", serverKey],
  ["STRIPE_SECRET_KEY", stripeKey],
].filter(([, value]) => !value).map(([name]) => name);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

const stripe = new Stripe(stripeKey, { appInfo: { name: "morrow-catalog-sync" } });
const db = createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
const mode = stripeKey.includes("_live_") ? "LIVE" : "TEST";
console.log(`Stripe mode: ${mode}`);

// 1. IVA 16% exclusive tax rate (prices are shown "+ IVA").
const taxRates = await stripe.taxRates.list({ active: true, limit: 100 });
let iva = taxRates.data.find((rate) => rate.metadata?.morrow === "iva-16");
if (!iva) {
  iva = await stripe.taxRates.create(
    {
      display_name: "IVA",
      description: "IVA 16% México",
      percentage: 16,
      inclusive: false,
      country: "MX",
      jurisdiction: "MX",
      tax_type: "vat",
      metadata: { morrow: "iva-16" },
    },
    { idempotencyKey: "morrow-tax-rate-iva-16" },
  );
}
console.log(`IVA tax rate: ${iva.id}  -> set STRIPE_IVA_TAX_RATE_ID=${iva.id}`);

// 2. Products and prices.
const { data: packages, error } = await db
  .from("billing_packages")
  .select("id,code,name,description,billing_package_prices(id,billing_interval,currency_code,amount_minor,status,stripe_product_id,stripe_price_id)")
  .eq("status", "ACTIVE")
  .order("code");
if (error) throw new Error(`Unable to read packages: ${error.message}`);

for (const pkg of packages) {
  const prices = pkg.billing_package_prices.filter((price) => price.status === "ACTIVE");
  let productId = prices.find((price) => price.stripe_product_id)?.stripe_product_id ?? null;
  if (!productId) {
    const product = await stripe.products.create(
      {
        name: `morrow ${pkg.name}`,
        description: pkg.description || undefined,
        metadata: { morrow_package_id: pkg.id, morrow_package_code: pkg.code },
        tax_code: "txcd_10103001",
      },
      { idempotencyKey: `morrow-product-${pkg.id}` },
    );
    productId = product.id;
  }

  for (const price of prices) {
    if (price.stripe_price_id && price.stripe_product_id) {
      console.log(`= ${pkg.code} ${price.billing_interval}: ${price.stripe_price_id}`);
      continue;
    }
    const created = await stripe.prices.create(
      {
        product: productId,
        currency: price.currency_code.toLowerCase(),
        unit_amount: Number(price.amount_minor),
        recurring: { interval: price.billing_interval === "YEAR" ? "year" : "month" },
        tax_behavior: "exclusive",
        nickname: `${pkg.name} ${price.billing_interval === "YEAR" ? "anual" : "mensual"}`,
        metadata: { morrow_package_price_id: price.id, morrow_package_code: pkg.code },
      },
      { idempotencyKey: `morrow-price-${price.id}-${price.amount_minor}` },
    );
    const { error: updateError } = await db
      .from("billing_package_prices")
      .update({ stripe_product_id: productId, stripe_price_id: created.id })
      .eq("id", price.id);
    if (updateError) throw new Error(`Unable to store Stripe IDs for ${price.id}: ${updateError.message}`);
    console.log(`+ ${pkg.code} ${price.billing_interval}: ${created.id}`);
  }
}

console.log("Catalog synchronized.");
