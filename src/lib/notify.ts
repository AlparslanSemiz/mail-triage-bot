import { env } from "./env";
import { sendDiscord } from "./discord";
import { sendTelegram } from "./telegram";

/** Sends to Discord when DISCORD_WEBHOOK_URL is set, otherwise to Telegram. */
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
    `Kimden: ${args.from}`,
    `Konu: ${args.subject}`,
    "",
    `Özet: ${args.summary}`,
    `Aksiyon: ${args.suggestedAction}`,
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
    args.body,
  ].join("\n");
  await notify(text);
}
