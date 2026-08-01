import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return _stripe;
}

export function priceIdForPlan(plan: "monthly" | "yearly"): string {
  return plan === "monthly"
    ? process.env.STRIPE_PRICE_ID_MONTHLY!
    : process.env.STRIPE_PRICE_ID_YEARLY!;
}
