import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  CLIENT_BASE_URL: z.string().url().default("http://localhost:3001"),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_ID_PRO_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_ID_PRO_YEARLY: z.string().min(1).optional(),
  BILLING_PLAN_CODE: z.string().min(1).default("pro_monthly"),
  JOURNAL_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(120),
  JOURNAL_SYNC_STALE_HOURS: z.coerce.number().int().min(1).default(168),
  WS_SNAPSHOT_DEBOUNCE_MS: z.coerce.number().int().min(1000).default(15000),
  INVITE_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).default(168),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().email().default("info@journi.com"),
  MAIL_REPLY_TO: z.string().email().default("support@journi.com"),
  SUPPORT_EMAIL: z.string().email().default("support@journi.com"),
  RESET_PASSWORD_REDIRECT_URL: z.string().url().optional(),
  // Optional - required only when the reformatter feature is used
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${formatted}`);
}

export const env = parsed.data;
