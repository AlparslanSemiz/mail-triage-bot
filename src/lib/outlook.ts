import { env } from "./env";
import { loadTokens, saveTokens } from "./kv";

const AUTHORITY = `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}`;
const SCOPES = ["Mail.Read", "offline_access", "User.Read"];

// ============================================================
// OAuth flow
// ============================================================

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: env.MICROSOFT_REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    client_secret: env.MICROSOFT_CLIENT_SECRET,
    code,
    redirect_uri: env.MICROSOFT_REDIRECT_URI,
    grant_type: "authorization_code",
    scope: SCOPES.join(" "),
  });

  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${errText}`);
  }

  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    client_secret: env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES.join(" "),
  });

  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Refresh failed: ${res.status} ${errText}`);
  }

  return (await res.json()) as TokenResponse;
}

async function getValidAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error(
      "No saved tokens. Visit /api/auth/outlook/login to authorize the app."
    );
  }

  // Refresh if expiring in next 5 minutes
  const now = Date.now();
  if (tokens.expiresAt - now > 5 * 60 * 1000) {
    return tokens.accessToken;
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  await saveTokens({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  });
  return refreshed.access_token;
}

// ============================================================
// Mail fetching
// ============================================================

export type OutlookMessage = {
  id: string;
  subject: string;
  bodyPreview: string;
  receivedDateTime: string;
  from: {
    emailAddress: { name: string; address: string };
  };
  isRead: boolean;
  importance: "low" | "normal" | "high";
  webLink: string;
};

/**
 * Fetches messages received after `since` from ALL folders, sorted oldest first.
 * Uses Graph API /me/messages which spans all folders by default.
 */
export async function fetchNewMessages(since: Date): Promise<OutlookMessage[]> {
  const token = await getValidAccessToken();
  const sinceIso = since.toISOString();

  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set("$filter", `receivedDateTime gt ${sinceIso}`);
  url.searchParams.set(
    "$select",
    "id,subject,bodyPreview,receivedDateTime,from,isRead,importance,webLink"
  );
  url.searchParams.set("$orderby", "receivedDateTime asc");
  url.searchParams.set("$top", "50");

  const messages: OutlookMessage[] = [];
  let next: string | null = url.toString();

  while (next) {
    const res: Response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Graph fetch failed: ${res.status} ${errText}`);
    }
    const data: { value: OutlookMessage[]; "@odata.nextLink"?: string } =
      await res.json();
    messages.push(...data.value);
    next = data["@odata.nextLink"] ?? null;

    // Safety: don't fetch more than 200 per poll
    if (messages.length >= 200) break;
  }

  return messages;
}
