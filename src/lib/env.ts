import { z } from "zod";

const envSchema = z
  .object({
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_TENANT_ID: z.string().default("common"),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_REDIRECT_URI: z.string().url(),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),

  // Either Discord (webhook) or Telegram (bot token + chat id) must be set.
  DISCORD_WEBHOOK_URL: z
    .string()
    .url()
    .refine((u) => /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(u), "not a Discord webhook URL")
    .optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Comma-separated own addresses; mails sent from these (Sent Items) are skipped.
  OWN_ADDRESSES: z.string().default(""),

  CRON_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex = 64 chars
  })
  .refine(
    (e) => e.DISCORD_WEBHOOK_URL || (e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_CHAT_ID),
    "Set DISCORD_WEBHOOK_URL, or TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID"
  );

export const env = envSchema.parse({
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID,
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
  MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI,

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,

  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || undefined,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || undefined,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || undefined,

  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

  OWN_ADDRESSES: process.env.OWN_ADDRESSES,
  CRON_SECRET: process.env.CRON_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
});

export type Env = z.infer<typeof envSchema>;
