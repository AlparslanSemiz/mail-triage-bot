import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/outlook";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  // Random state for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = buildAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 min
  });
  return response;
}
