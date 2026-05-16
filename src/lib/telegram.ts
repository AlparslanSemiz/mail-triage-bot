import { env } from "./env";

const TG_API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

type SendOptions = {
  /** When true, escapes text for MarkdownV2; default plain text */
  markdown?: boolean;
  /** Link preview disabled by default for cleaner notifications */
  disablePreview?: boolean;
};

// MarkdownV2 special characters that must be escaped
const MD_SPECIAL = /[_*[\]()~`>#+\-=|{}.!\\]/g;

function escapeMd(s: string): string {
  return s.replace(MD_SPECIAL, "\\$&");
}

export async function sendTelegram(
  text: string,
  opts: SendOptions = {}
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: opts.disablePreview ?? true,
  };
  if (opts.markdown) body.parse_mode = "MarkdownV2";

  const res = await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${errText}`);
  }
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
  await sendTelegram(text);
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
  await sendTelegram(text);
}

export { escapeMd };
