/**
 * Run with: npm run get-chat-id
 *
 * Steps:
 * 1. Make sure you've sent /start to your bot in Telegram.
 * 2. Run this script — it'll print your chat ID.
 * 3. Copy the chat ID into TELEGRAM_CHAT_ID in your .env / Vercel env vars.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

async function main() {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = (await res.json()) as {
    ok: boolean;
    result: Array<{
      message?: { chat: { id: number; first_name?: string; username?: string } };
    }>;
  };

  if (!data.ok) {
    console.error("Telegram API error:", data);
    process.exit(1);
  }

  if (data.result.length === 0) {
    console.log(
      "No updates found. Send /start to your bot in Telegram, then run this again."
    );
    return;
  }

  const chats = new Map<number, { name?: string; username?: string }>();
  for (const update of data.result) {
    const chat = update.message?.chat;
    if (chat) {
      chats.set(chat.id, { name: chat.first_name, username: chat.username });
    }
  }

  console.log("\nFound chat IDs:\n");
  for (const [id, info] of chats) {
    console.log(`  ${id}  →  ${info.name ?? ""} ${info.username ? "(@" + info.username + ")" : ""}`);
  }
  console.log(
    "\nCopy the relevant chat ID into TELEGRAM_CHAT_ID in your env file.\n"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
