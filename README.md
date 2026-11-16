<h1 align="center">Mail Triage Bot</h1>
<p align="center">Sorts your Outlook inbox with Gemini: urgent mail reaches Telegram at once, the rest arrives in a twice-daily digest.</p>

<p align="center">
<img src="https://img.shields.io/badge/Next.js-15-555?style=flat" alt="Next.js 15">
<img src="https://img.shields.io/badge/TypeScript-555?style=flat" alt="TypeScript">
<img src="https://img.shields.io/badge/runs%20on-free%20tiers-555?style=flat" alt="runs on free tiers">
</p>

<p align="center"><b><a href="#setup">Set it up</a></b> · <a href="#architecture">Architecture</a> · <a href="#cost">Cost</a></p>

## Why

A busy inbox hides the few mails that need an answer now. This bot checks Outlook every hour, asks Gemini to classify each new mail, and sends only the urgent ones to Telegram immediately. Everything else is queued and summarised at 09:00 and 18:00 (Istanbul time).

## Features

- Hourly polling of Outlook through Microsoft Graph (OAuth with a refresh token, stored encrypted).
- Gemini classifies each mail. The default prompt is tuned for a lawyer's inbox and is easy to change.
- Instant Telegram alerts for urgent mail; digest summaries for the rest.
- Deduplication and a digest queue in Upstash Redis.
- Scheduling with GitHub Actions, because Vercel Hobby cron runs only daily.
- Designed to fit the free tiers of every service it uses (see [Cost](#cost)).

## Tech

- **Next.js 15** (App Router, TypeScript) on **Vercel** (Hobby plan, free)
- **Microsoft Graph API** for Outlook (delegated permissions, OAuth + refresh token)
- **Google Gemini** (2.5 Flash by default) for classification + digest summarization
- **Telegram Bot API** for delivery
- **Upstash Redis** for token storage, deduplication, digest queue
- **GitHub Actions** for scheduling (Vercel Hobby cron is daily-only)

## Architecture

```
                ┌──────────────────┐
                │  GitHub Actions  │
                │   (cron trigger) │
                └────────┬─────────┘
                         │ HTTP + Bearer
                         ▼
┌─────────────────────────────────────────────────┐
│              Vercel (Next.js API)                │
│                                                  │
│   /api/cron/poll  ◄── hourly                    │
│       │                                          │
│       ├──► Microsoft Graph (fetch new mails)    │
│       ├──► Gemini (classify each mail)          │
│       ├──► Telegram (instant alerts)            │
│       └──► Upstash (queue + dedupe)             │
│                                                  │
│   /api/cron/digest ◄── 09:00 & 18:00            │
│       │                                          │
│       ├──► Upstash (flush queue)                │
│       ├──► Gemini (summarize batch)             │
│       └──► Telegram (digest message)            │
└─────────────────────────────────────────────────┘
```

## Setup

Requires Node 20 or later.

### 1. Clone and install

```bash
git clone https://github.com/AlparslanSemiz/mail-triage-bot.git
cd mail-triage-bot
npm install
cp .env.example .env.local
```

### 2. Create an Upstash Redis database

1. Go to [console.upstash.com](https://console.upstash.com) and sign up (free).
2. Create a new database. Region: choose closest to your Vercel region (Frankfurt for EU).
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into `.env.local`.

### 3. Fill in credentials

Edit `.env.local`:

- `MICROSOFT_CLIENT_ID`: from Azure App Registration
- `MICROSOFT_TENANT_ID`: leave as `common` (works for both personal + work accounts)
- `MICROSOFT_CLIENT_SECRET`: from Azure → Certificates & secrets
- `MICROSOFT_REDIRECT_URI`: for local dev: `http://localhost:3000/api/auth/outlook/callback`. For prod, your Vercel URL.
- `GEMINI_API_KEY`: from aistudio.google.com
- `TELEGRAM_BOT_TOKEN`: from @BotFather
- `TELEGRAM_CHAT_ID`: see step 5
- `CRON_SECRET`: `openssl rand -hex 32`
- `ENCRYPTION_KEY`: `openssl rand -hex 32` (must be exactly 64 hex chars)

### 4. Add redirect URI to Azure

In Azure Portal → your app → Authentication → Add a platform → **Web** → enter your redirect URI(s):

- `http://localhost:3000/api/auth/outlook/callback` (for local dev)
- `https://<your-app>.vercel.app/api/auth/outlook/callback` (for prod, add after deploy)

### 5. Get your Telegram chat ID

```bash
# First send /start to your bot in Telegram
npm run get-chat-id
```

Copy the chat ID into `TELEGRAM_CHAT_ID`.

### 6. Deploy to Vercel

```bash
# Push to GitHub first
git add .
git commit -m "Initial commit"
git push

# Then either:
# (a) Import repo at vercel.com/new
# (b) Or: npm i -g vercel && vercel
```

In Vercel dashboard → Settings → Environment Variables, paste all values from `.env.local` (except `MICROSOFT_REDIRECT_URI` which should now use your `.vercel.app` URL).

Redeploy after env vars are set.

### 7. Connect Outlook

Visit `https://<your-app>.vercel.app/api/auth/outlook/login` and complete the OAuth consent. Tokens are saved encrypted in Upstash.

### 8. Configure GitHub Actions

In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

- `DEPLOY_URL` = `https://<your-app>.vercel.app`
- `CRON_SECRET` = same value as in Vercel env vars

Workflows will start firing on schedule automatically. You can also trigger them manually from the Actions tab.

## Testing

### Manual poll trigger (after deploy)

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-app>.vercel.app/api/cron/poll
```

### Manual digest trigger

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-app>.vercel.app/api/cron/digest
```

## Customization

### Classification rules

Edit `src/lib/gemini.ts` → `SYSTEM_PROMPT`. The default is tuned for a lawyer; adjust the criteria, sender patterns, and category labels to your context.

### Digest schedule

Edit `.github/workflows/send-digest.yml`. Cron expressions are UTC. Istanbul is UTC+3 year-round.

### Polling frequency

Edit `.github/workflows/poll-emails.yml`. Default is hourly.

## Cost

Free tier should cover personal use entirely:

- **Vercel Hobby**: free, 100 GB bandwidth, 100 GB-hours function execution
- **Upstash Redis**: free, 10K commands/day, 256 MB
- **Gemini API**: free tier covers ~1500 requests/day
- **GitHub Actions**: free, 2000 min/month on private repos (we use ~800: 24 hourly polls + 2 digests a day is about 780 runs a month, each billed at least 1 minute)

If Gemini free tier runs out, switch to `gemini-2.5-flash-lite` (cheaper) in env vars.

## Adding more accounts later

For Gmail support: add a parallel `/api/auth/gmail/*` flow and `lib/gmail.ts`. The classifier and Telegram code stay the same.

## Status

A personal tool, set up for one Outlook account. Gmail is not supported yet.
