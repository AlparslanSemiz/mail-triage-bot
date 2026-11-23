import { env } from "./env";

/** Discord rejects webhook messages longer than 2000 characters. */
export const DISCORD_LIMIT = 2000;

/** Splits text into chunks of at most `limit` chars, preferring line breaks. */
export function splitMessage(text: string, limit = DISCORD_LIMIT): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut <= 0) {
      cut = limit;
      // Never cut between a backslash and the character it escapes: an odd run
      // of trailing backslashes means the next char would start unescaped.
      let run = 0;
      while (run < cut && rest[cut - 1 - run] === "\\") run++;
      if (run % 2 === 1) cut -= 1;
    }
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

/**
 * Escapes Discord markdown so mail content (subject, sender, AI summary) can't
 * render as masked links, headings or formatting that imitates the real link.
 */
export function escapeDiscord(s: string): string {
  return s.replace(/[\\*_~`|>\[\]()#\-:<@]/g, "\\$&");
}

export async function sendDiscord(text: string): Promise<void> {
  for (const content of splitMessage(text)) {
    const res = await fetch(env.DISCORD_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // allowed_mentions: none, so mail content can never ping anyone.
      body: JSON.stringify({ content, allowed_mentions: { parse: [] }, flags: 4 }),
      // flags 4 = SUPPRESS_EMBEDS: no preview cards for links inside mail text.
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Discord send failed: ${res.status} ${errText}`);
    }
  }
}
