import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { flushDigest } from "@/lib/kv";
import { generateDigestSummary } from "@/lib/gemini";
import { sendDigest } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  const queryToken = new URL(req.url).searchParams.get("token");
  const provided =
    header?.replace(/^Bearer\s+/, "") ?? queryToken ?? "";
  return provided === env.CRON_SECRET;
}

function digestTitle(): string {
  // Server runs UTC. Convert to Istanbul/Karlsruhe local-ish for title.
  // We just use UTC hour as a hint — the cron schedule controls when it fires.
  const hour = new Date().getUTCHours();
  if (hour < 12) return "Sabah Mail Özeti";
  return "Akşam Mail Özeti";
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await flushDigest();

    if (items.length === 0) {
      await sendDigest({
        title: digestTitle(),
        body: "Bu dönemde özet için bekleyen mail yok.",
        count: 0,
      });
      return NextResponse.json({ ok: true, count: 0 });
    }

    // Sort: important first, then by time
    items.sort((a, b) => {
      const aImp = a.category.startsWith("important:") ? 0 : 1;
      const bImp = b.category.startsWith("important:") ? 0 : 1;
      if (aImp !== bImp) return aImp - bImp;
      return a.receivedAt.localeCompare(b.receivedAt);
    });

    const summary = await generateDigestSummary(
      items.map((i) => ({
        from: i.from,
        subject: i.subject,
        summary: i.summary,
        category: i.category,
      }))
    );

    await sendDigest({
      title: digestTitle(),
      body: summary,
      count: items.length,
    });

    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Digest failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
