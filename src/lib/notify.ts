import { env } from "./env";
import { escapeDiscord, sendDiscord } from "./discord";
import { sendTelegram } from "./telegram";

/** Sends to Discord when DISCORD_WEBHOOK_URL is set, otherwise to Telegram. */
/** Untrusted text (from mail or AI output) is escaped only for Discord; Telegram is sent as plain text. */
function safe(s: string): string {
  return env.DISCORD_WEBHOOK_URL ? escapeDiscord(s) : s;
}

export async function notify(text: string): Promise<void> {
  if (env.DISCORD_WEBHOOK_URL) return sendDiscord(text);
  return sendTelegram(text);
}

/**
 * Sends an instant alert for a high-urgency email.
 * Plain text (no markdown) to avoid escaping pain with arbitrary subject lines.
 */
export async function sendInstantAlert(args: {
  from: string;
  subject: string;
  summary: string;
  suggestedAction: string;
  webLink: string;
}): Promise<void> {
  const text = [
    "🚨 ACİL MAİL",
    "",
    `Kimden: ${safe(args.from)}`,
    `Konu: ${safe(args.subject)}`,
    "",
    `Özet: ${safe(args.summary)}`,
    `Aksiyon: ${safe(args.suggestedAction)}`,
    "",
    `Açmak için: ${args.webLink}`,
  ].join("\n");
  await notify(text);
}

export async function sendDigest(args: {
  title: string;
  body: string;
  count: number;
}): Promise<void> {
  const text = [
    `📬 ${args.title}`,
    `(${args.count} mail)`,
    "",
    safe(args.body),
  ].join("\n");
  await notify(text);
}
