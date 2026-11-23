import { test } from "node:test";
import assert from "node:assert/strict";

process.env.GEMINI_API_KEY ??= "test";
for (const k of ["MICROSOFT_CLIENT_ID","MICROSOFT_CLIENT_SECRET","TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID","UPSTASH_REDIS_REST_TOKEN"]) process.env[k] ??= "x";
process.env.MICROSOFT_REDIRECT_URI ??= "https://e.x/cb";
process.env.UPSTASH_REDIS_REST_URL ??= "https://e.x";
process.env.CRON_SECRET ??= "x".repeat(16);
process.env.ENCRYPTION_KEY ??= "0".repeat(64);

test("non-retryable error is thrown at once", async () => {
  const { withRetry } = await import("../src/lib/gemini");
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new Error("400 bad request"); }));
  assert.equal(n, 1);
});

test("429 is retried then succeeds", async () => {
  const { withRetry } = await import("../src/lib/gemini");
  let n = 0;
  const v = await withRetry(async () => { if (++n < 2) throw new Error("[429 Too Many Requests]"); return "ok"; });
  assert.equal(v, "ok");
  assert.equal(n, 2);
});
