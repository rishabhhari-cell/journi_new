import express, { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { env } from "../config/env";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import {
  getSubscriptionByStripeCustomerId,
  getSubscriptionForUser,
  hasProEntitlement,
  mapRawStatus,
} from "../services/billing.service";

export const billingRouter = Router();

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, "Stripe is not configured", "BILLING_NOT_CONFIGURED");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

function unixToIso(value?: number | null): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

async function resolveStripeCustomerForUser(
  stripe: Stripe,
  userId: string,
  email: string,
): Promise<string> {
  const existing = await getSubscriptionForUser(userId);
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });
  return customer.id;
}

const checkoutSchema = z.object({
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const portalSchema = z.object({
  returnUrl: z.string().url().optional(),
});

billingRouter.use(requireAuth);

function resolvePriceId(interval: "monthly" | "yearly"): string {
  if (interval === "yearly") {
    if (!env.STRIPE_PRICE_ID_PRO_YEARLY) {
      throw new HttpError(503, "Stripe yearly price is not configured", "BILLING_NOT_CONFIGURED");
    }
    return env.STRIPE_PRICE_ID_PRO_YEARLY;
  }
  if (!env.STRIPE_PRICE_ID_PRO_MONTHLY) {
    throw new HttpError(503, "Stripe monthly price is not configured", "BILLING_NOT_CONFIGURED");
  }
  return env.STRIPE_PRICE_ID_PRO_MONTHLY;
}

function resolvePlanCodeFromPriceId(priceId: string | null | undefined): string {
  if (priceId && env.STRIPE_PRICE_ID_PRO_YEARLY && priceId === env.STRIPE_PRICE_ID_PRO_YEARLY) {
    return "pro_yearly";
  }
  if (priceId && env.STRIPE_PRICE_ID_PRO_MONTHLY && priceId === env.STRIPE_PRICE_ID_PRO_MONTHLY) {
    return "pro_monthly";
  }
  return env.BILLING_PLAN_CODE;
}

billingRouter.get("/me", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const subscription = await getSubscriptionForUser(authReq.auth.userId);

    res.json({
      data: {
        subscription,
        hasProAccess: hasProEntitlement(subscription?.status ?? "unknown"),
      },
    });
  } catch (error) {
    next(error);
  }
});

billingRouter.post("/checkout-session", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = checkoutSchema.parse(req.body ?? {});
    const stripe = getStripe();

    const priceId = resolvePriceId(input.billingInterval);
    const planCode = input.billingInterval === "yearly" ? "pro_yearly" : "pro_monthly";

    const customerId = await resolveStripeCustomerForUser(stripe, authReq.auth.userId, authReq.auth.email);
    const successUrl = input.successUrl ?? `${env.CLIENT_BASE_URL}/pricing?billing=success`;
    const cancelUrl = input.cancelUrl ?? `${env.CLIENT_BASE_URL}/pricing?billing=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: authReq.auth.userId,
        planCode,
      },
      subscription_data: {
        metadata: {
          userId: authReq.auth.userId,
          planCode,
        },
      },
    });

    res.status(201).json({
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

billingRouter.post("/customer-portal", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = portalSchema.parse(req.body ?? {});
    const stripe = getStripe();

    const subscription = await getSubscriptionForUser(authReq.auth.userId);
    if (!subscription?.stripeCustomerId) {
      throw new HttpError(404, "No Stripe customer found for user", "BILLING_CUSTOMER_NOT_FOUND");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: input.returnUrl ?? `${env.CLIENT_BASE_URL}/pricing`,
    });

    res.json({ data: { url: session.url } });
  } catch (error) {
    next(error);
  }
});

async function upsertSubscriptionFromStripe(params: {
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
  status: string | null | undefined;
  currentPeriodEnd: number | null | undefined;
  cancelAtPeriodEnd: boolean;
  planCode: string;
  payload: Record<string, unknown>;
}) {
  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.customerId,
      stripe_subscription_id: params.subscriptionId,
      status: mapRawStatus(params.status),
      current_period_end: unixToIso(params.currentPeriodEnd),
      plan_code: params.planCode,
      cancel_at_period_end: params.cancelAtPeriodEnd,
      latest_payload: params.payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

async function resolveUserIdForSubscriptionEvent(stripe: Stripe, subscription: Stripe.Subscription): Promise<string | null> {
  const subMetadataUserId = subscription.metadata?.userId;
  if (subMetadataUserId) return subMetadataUserId;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;

  const known = await getSubscriptionByStripeCustomerId(customerId);
  if (known?.userId) return known.userId;

  const customer = await stripe.customers.retrieve(customerId);
  if (!("deleted" in customer) && customer.metadata?.userId) {
    return customer.metadata.userId;
  }

  return null;
}

export async function billingWebhookHandler(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new HttpError(503, "Stripe webhook secret is not configured", "BILLING_NOT_CONFIGURED");
    }
    const stripe = getStripe();
    const signature = req.header("stripe-signature");
    if (!signature) {
      throw new HttpError(400, "Missing Stripe signature", "BILLING_WEBHOOK_INVALID_SIGNATURE");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      throw new HttpError(400, "Invalid Stripe webhook signature", "BILLING_WEBHOOK_INVALID_SIGNATURE", {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const { error: eventInsertError } = await supabaseAdmin.from("billing_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed_at: new Date().toISOString(),
    });

    const isDuplicate = eventInsertError
      ? (eventInsertError as { code?: string }).code === "23505"
      : false;
    if (eventInsertError && !isDuplicate) {
      throw new HttpError(500, eventInsertError.message, "BILLING_EVENT_RECORD_FAILED");
    }
    if (eventInsertError && isDuplicate) {
      return res.json({ ok: true, duplicate: true });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdForSubscriptionEvent(stripe, subscription);
      if (!userId) {
        return res.json({ ok: true, skipped: "user_not_resolved" });
      }

      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null;
      const firstPriceId = subscription.items?.data?.[0]?.price?.id ?? null;
      const planCode = resolvePlanCodeFromPriceId(firstPriceId);

      await upsertSubscriptionFromStripe({
        userId,
        customerId,
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        planCode,
        payload: subscription as unknown as Record<string, unknown>,
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && typeof session.customer === "string") {
        const userId = session.metadata?.userId;
        if (userId) {
          await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: userId,
              stripe_customer_id: session.customer,
              stripe_subscription_id:
                typeof session.subscription === "string" ? session.subscription : null,
              status: "incomplete",
              plan_code:
                session.metadata?.planCode === "pro_yearly" || session.metadata?.planCode === "pro_monthly"
                  ? session.metadata.planCode
                  : env.BILLING_PLAN_CODE,
              latest_payload: session as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        }
      }
    }

    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
