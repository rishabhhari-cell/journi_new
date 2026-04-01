import { supabaseAdmin } from "../lib/supabase";

export type BillingStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused"
  | "unknown";

export interface SubscriptionRecord {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: BillingStatus;
  currentPeriodEnd: string | null;
  planCode: string;
  cancelAtPeriodEnd: boolean;
}

export function mapRawStatus(status: string | null | undefined): BillingStatus {
  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "canceled" ||
    status === "incomplete" ||
    status === "incomplete_expired" ||
    status === "unpaid" ||
    status === "paused"
  ) {
    return status;
  }
  return "unknown";
}

export function hasProEntitlement(status: BillingStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export async function getSubscriptionForUser(userId: string): Promise<SubscriptionRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, plan_code, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    userId: data.user_id,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    status: mapRawStatus(data.status),
    currentPeriodEnd: data.current_period_end,
    planCode: data.plan_code,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
  };
}

export async function getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<SubscriptionRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, plan_code, cancel_at_period_end")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    userId: data.user_id,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    status: mapRawStatus(data.status),
    currentPeriodEnd: data.current_period_end,
    planCode: data.plan_code,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
  };
}

