import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { fetchNewMessages } from "@/lib/outlook";
import { classifyMessage } from "@/lib/gemini";
import {
  isProcessed,
  markProcessed,
  enqueueDigest,
  getLastPoll,
  setLastPoll,
} from "@/lib/kv";
import { sendInstantAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — Vercel Hobby allows up to 60s

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  const queryToken = new URL(req.url).searchParams.get("token");
  const provided =
    header?.replace(/^Bearer\s+/, "") ?? queryToken ?? "";
  return provided === env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const since = await getLastPoll();

  try {
    const messages = await fetchNewMessages(since);

    let processed = 0;
    let instant = 0;
    let queued = 0;
    let skipped = 0;
    const newlyProcessedIds: string[] = [];

    for (const msg of messages) {
      // Skip if already processed (defensive — filter should handle it)
      if (await isProcessed(msg.id)) continue;

      processed++;
      const cls = await classifyMessage(msg);

      const from =
        msg.from?.emailAddress?.name ||
        msg.from?.emailAddress?.address ||
        "Bilinmeyen";

      if (cls.urgency === "instant") {
        await sendInstantAlert({
          from,
          subject: msg.subject ?? "(konu yok)",
          summary: cls.summary_tr,
          suggestedAction: cls.suggested_action,
          webLink: msg.webLink,
        });
        instant++;
      } else if (cls.urgency === "important" || cls.urgency === "normal") {
        await enqueueDigest({
          id: msg.id,
          from,
          subject: msg.subject ?? "(konu yok)",
          summary: cls.summary_tr,
          category: `${cls.urgency}:${cls.category}`,
          receivedAt: msg.receivedDateTime,
        });
        queued++;
      } else {
        skipped++;
      }

      newlyProcessedIds.push(msg.id);
    }

    if (newlyProcessedIds.length > 0) {
      await markProcessed(newlyProcessedIds);
    }
    await setLastPoll(startedAt);

    return NextResponse.json({
      ok: true,
      since: since.toISOString(),
      until: startedAt.toISOString(),
      fetched: messages.length,
      processed,
      instant,
      queued,
      skipped,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Poll failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
