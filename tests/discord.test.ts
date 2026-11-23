import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DISCORD_WEBHOOK_URL ??= "https://discord.com/api/webhooks/1/abc";
for (const k of ["MICROSOFT_CLIENT_ID","MICROSOFT_CLIENT_SECRET","GEMINI_API_KEY","UPSTASH_REDIS_REST_TOKEN"]) process.env[k] ??= "x";
process.env.MICROSOFT_REDIRECT_URI ??= "https://e.x/cb";
process.env.UPSTASH_REDIS_REST_URL ??= "https://e.x";
process.env.CRON_SECRET ??= "x".repeat(16);
process.env.ENCRYPTION_KEY ??= "0".repeat(64);

test("short text is one chunk", async () => {
  const { splitMessage } = await import("../src/lib/discord");
  assert.deepEqual(splitMessage("merhaba"), ["merhaba"]);
});

test("long text splits at line breaks within the limit", async () => {
  const { splitMessage } = await import("../src/lib/discord");
  const lines = Array.from({ length: 300 }, (_, i) => `satır ${i} ` + "x".repeat(20));
  const chunks = splitMessage(lines.join("\n"));
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.length <= 2000);
  assert.equal(chunks.join("\n"), lines.join("\n"));
});

test("a single line longer than the limit is hard-cut", async () => {
  const { splitMessage } = await import("../src/lib/discord");
  const chunks = splitMessage("y".repeat(4500));
  assert.deepEqual(chunks.map((c) => c.length), [2000, 2000, 500]);
});

test("Discord alone (no Telegram) is a valid config", async () => {
  const { env } = await import("../src/lib/env");
  assert.ok(env.DISCORD_WEBHOOK_URL);
});
