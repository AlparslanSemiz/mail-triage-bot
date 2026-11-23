import { env } from "./env";



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

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${errText}`);
  }
}

export { escapeMd };
