import { Redis } from "@upstash/redis";
import { env } from "./env";
import crypto from "crypto";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// ============================================================
// Token encryption (for refresh tokens stored in Redis)
// ============================================================
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

export function decrypt(blob: string): string {
  const [ivHex, tagHex, encHex] = blob.split(":");
  if (!ivHex || !tagHex || !encHex) throw new Error("Invalid encrypted blob");
  const decipher = crypto.createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

// ============================================================
// Microsoft OAuth tokens
// ============================================================
type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
};

const TOKEN_KEY = "outlook:tokens";

export async function saveTokens(t: TokenBundle): Promise<void> {
  const payload = JSON.stringify({
    accessToken: t.accessToken,
    refreshToken: encrypt(t.refreshToken),
    expiresAt: t.expiresAt,
  });
  await redis.set(TOKEN_KEY, payload);
}

export async function loadTokens(): Promise<TokenBundle | null> {
  const raw = await redis.get<string>(TOKEN_KEY);
  if (!raw) return null;
  // Upstash may return parsed JSON automatically — normalize
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return {
    accessToken: parsed.accessToken,
    refreshToken: decrypt(parsed.refreshToken),
    expiresAt: parsed.expiresAt,
  };
}

// ============================================================
// Processed email tracking (avoid duplicate notifications)
// ============================================================
const PROCESSED_KEY = "outlook:processed_ids";

export async function isProcessed(messageId: string): Promise<boolean> {
  const result = await redis.sismember(PROCESSED_KEY, messageId);
  return result === 1;
}

export async function markProcessed(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  await redis.sadd(PROCESSED_KEY, ...messageIds);
}

// ============================================================
// Digest queue (emails to include in next digest)
// ============================================================
const DIGEST_KEY = "digest:pending";

export type DigestItem = {
  id: string;
  from: string;
  subject: string;
  summary: string;
  category: string;
  receivedAt: string;
};

export async function enqueueDigest(item: DigestItem): Promise<void> {
  await redis.lpush(DIGEST_KEY, JSON.stringify(item));
}

export async function flushDigest(): Promise<DigestItem[]> {
  const all = await redis.lrange<string>(DIGEST_KEY, 0, -1);
  await redis.del(DIGEST_KEY);
  return all.map((s) => (typeof s === "string" ? JSON.parse(s) : s));
}

// ============================================================
// Last-poll timestamp (for incremental fetching)
// ============================================================
const LAST_POLL_KEY = "outlook:last_poll";

export async function getLastPoll(): Promise<Date> {
  const ts = await redis.get<number>(LAST_POLL_KEY);
  if (!ts) {
    // First run — only look at last hour
    return new Date(Date.now() - 60 * 60 * 1000);
  }
  return new Date(ts);
}

export async function setLastPoll(date: Date): Promise<void> {
  await redis.set(LAST_POLL_KEY, date.getTime());
}
