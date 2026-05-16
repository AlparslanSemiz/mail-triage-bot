import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/outlook";
import { saveTokens } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error) {
    return NextResponse.json(
      { error, error_description: errorDesc },
      { status: 400 }
    );
  }
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // CSRF check
  const savedState = req.cookies.get("oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.json(
      { error: "Invalid state — possible CSRF" },
      { status: 400 }
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem;">
        <h1>✅ Outlook bağlandı</h1>
        <p>Bot artık mail kutunu izlemeye başladı. Bu sekmeyi kapatabilirsin.</p>
        <p>Test için: <a href="/api/cron/poll?token=test">manuel poll</a> (sadece dev)</p>
       </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
