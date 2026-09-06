# myDashboard

A personal dashboard that puts everything you need to check every day on one page: Gmail, Google Calendar, Slack, Discord, and GitHub. Open it once and you see the whole picture — no more jumping between five different apps.

Everything is pulled fresh from your real accounts every time you open the page. There's no database saving a copy anywhere.

## Getting started

```bash
npm install
cp .env.example .env    # fill in your credentials — full steps in SETUP.md
npm run build            # build the web app (React) the first time — run again after any change in web/
npm start
```

Open http://localhost:3000 and click **Connect Gmail** once (one button asks for both Gmail and Calendar at the same time). Everything else — Slack, Discord, GitHub, LINE, Login — is optional. Connect them whenever you want, no rush.

Every feature **turns on or off automatically based on what you set in `.env`**. Skip a setting and that tab just doesn't show up — nothing breaks.

Step-by-step guide for getting credentials from Google / Slack / Discord / GitHub / LINE is in **[SETUP.md](SETUP.md)**.

## What's in each tab

- **Overview** — the important numbers at a glance (emails waiting, Slack messages to you, today's plans) plus a list of stuff you should probably read
- **Mailbox** — emails still sitting in your Inbox, grouped by label. Mark as read or delete right from the page
- **Calendar** — a monthly view of everything on your visible Google Calendars. View, add, edit, delete — **changes go straight back to Google Calendar, for real**
- **Slack** — DMs sent to you and activity in channels you're in. Works with more than one workspace at once
- **Discord** — activity in the channels you picked (no DMs — see "Things worth knowing" below for why)
- **GitHub** — a contribution calendar like the one on your GitHub profile, plus your latest commits
- **Connect more** — see what's connected, connect/disconnect Gmail, and a "Send summary to LINE" button (pushes a short daily recap to your own LINE)

## Login (for when you deploy this somewhere public)

By default, this dashboard **has no login at all** — it's built to run on your own machine, just for you. But if you're putting it on a public domain (like `notify.siwat.me`), you need to stop random people from seeing your email and chats.

Set these two in `.env` to turn login on:

```
ALLOWED_EMAIL=your@email.com
SESSION_SECRET=<generate one — see SETUP.md>
```

Once set, every page and every API call needs you to **log in with Google first, and only that exact email can get in**. This uses a separate OAuth flow from the one that reads your Gmail — it only asks to know your email address, nothing else. Leave it unset and the app stays open like before.

Full setup steps (Google Cloud Console, redirect URIs) are in **[SETUP.md §6](SETUP.md)**.

## Deploying (Render + Cloudflare)

1. **Render** → New → Blueprint → pick this repo (it already has a `render.yaml` that sets the build/start commands for you)
2. Fill in the environment variables Render asks for when creating the service (the secret ones like `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `SLACK_USER_TOKEN`, etc.) — **make sure to set `ALLOWED_EMAIL` and `SESSION_SECRET` too**, or anyone who finds the URL can read your email and chats
3. Render → Settings → Custom Domains → add your domain to get a target hostname (something like `mydashboard.onrender.com`) to point your DNS at
4. **Cloudflare** → DNS → add a CNAME record pointing your subdomain at that Render hostname — set it to **DNS only (grey cloud)** first so Render can issue a TLS certificate, then switch to proxied (orange cloud) later if you want
5. Back in Google Cloud Console → add your live callback URLs to the OAuth client's Authorized redirect URIs (matching whatever `GOOGLE_REDIRECT_URI` / `SITE_REDIRECT_URI` you set on Render)

## Project structure

```
myDashboard/
├── web/                      the web app — React + Tailwind (Vite), see web/README.md for details
│   └── dist/                 output after npm run build — server/index.js serves this folder
├── public/
│   └── login.html            login page (only shown when the login feature is on)
├── server/
│   ├── index.js              express routes + a 60-second cache
│   ├── google.js             OAuth2 flow (Gmail/Calendar) + saves/refreshes token.json
│   ├── auth.js               a separate OAuth2 flow just for the site login
│   ├── gmail.js              summary() / inbox()
│   ├── calendar.js           month() + create/edit/delete events
│   ├── slack.js              dms() / feed()
│   ├── discord.js            feed() — REST API using a bot token
│   ├── github.js             overview() — GraphQL
│   └── line.js               digest() — sends the daily summary to LINE
└── SETUP.md                  step-by-step setup guide
```

## How it works (if you want to read the code)

The web app (`web/`) is a plain React SPA that only talks to the backend through `/api/*`. The code layout on that side is explained in [web/README.md](web/README.md).

### All the API routes

| Route | Returns |
|---|---|
| `GET /api/status` | `{gmail, gmailWrite, calendar, slack, github, discord, line, loginEnabled}` — all booleans |
| `GET /api/mail/summary` | `{inbox, unread, trash, labels: [{name, threads, messages, unread, color}]}` |
| `GET /api/mail/inbox` | `[{name, domain, subject, date, unread, isLinkedIn}]` |
| `GET /api/mail/message/:id` | the full email content |
| `POST /api/mail/read` | mark as read — body `{id}` |
| `POST /api/mail/trash` | move to trash — body `{id}` |
| `GET /api/slack` | `{dms: [], feed: []}` — each item is `{chan, isDm, author, text, ts}` |
| `GET /api/discord` | `[{chan, isDm: false, author, text, ts}]` — messages from the channels in `DISCORD_CHANNEL_IDS` |
| `GET /api/github` | `{login, total, weeks, commits}` — `weeks` is the calendar, `commits[].mine` says if it's the token owner's own commit |
| `GET /api/calendar?month=YYYY-MM` | `{month, tz, calendars, events}` |
| `POST /api/calendar` | add an event — body `{calendarId, title, allDay, start, end, location, description}` |
| `PATCH /api/calendar` | edit an event — same body as POST + `eventId` |
| `DELETE /api/calendar` | delete an event — body `{calendarId, eventId}` |
| `POST /api/line/digest` | bundles inbox/today's plans/Slack into a message, pushes it to `LINE_USER_ID` |
| `GET /auth/google` | redirects to the Google consent screen (Gmail/Calendar) |
| `GET /auth/google/callback` | trades the code for a token, saves it to `token.json` |
| `POST /auth/google/logout` | deletes `token.json` |
| `GET /login` | the login page (only when `ALLOWED_EMAIL`/`SESSION_SECRET` are set) |
| `GET /auth/site/login` | redirects to Google consent for the site-login flow |
| `GET /auth/site/callback` | checks the email matches `ALLOWED_EMAIL`, then sets a session cookie |
| `POST /auth/site/logout` | clears the session cookie |

For the smaller technical stuff (what scopes it asks for, why GraphQL vs REST, caching, etc.) — check the comments in each source file, written right where the decision was made.

## Things worth knowing

- **One owner per instance** — this isn't a multi-user system. If someone else wants to use it, they need to run their own copy (login also only supports one email per instance)
- Discord has no DMs because the bot is a separate account from you — it can't read private messages, that's just how Discord's rules work
- Discord/Slack only pull back so much history — a very active channel or DM might not show a full 7 days
- The calendar only pulls calendars that are **currently checked/visible** in Google Calendar. If an event's missing, go check that calendar's box on the Google Calendar website first
- If your OAuth consent screen is still in "Testing" mode, the refresh token expires after 7 days and you'll need to reconnect. Publish the app if you want it to last

## Security

**By default, this dashboard has no login system** — anyone who opens the page can read your email and Slack right away, and even edit/delete calendar events. It's meant to run on your own machine only. If you're deploying it somewhere others can reach, turn on the Login feature first (see above).

| What's in place | Where |
|---|---|
| Only binds to loopback by default — other devices on your network can't reach it | `HOST` defaults to `127.0.0.1` in `server/index.js` |
| A `state` value to block CSRF on the OAuth callback | `server/index.js` |
| `token.json` is written with `0600` permissions | `writeToken()` in `server/google.js` |
| Tokens/secrets get stripped out of any error message sent to the browser | `safe()` in `server/index.js` |
| Gmail/Calendar only asks for the minimum scopes it needs, never full access | `SCOPES` in `server/google.js` |
| Rejects requests coming from a different origin — stops some other open tab from firing commands at your instance | middleware in `server/index.js` |
| GitHub token only needs `read:user` (add `repo` if you want private repos to show up) | set this when you create the token |

**Stuff that should never end up on git** — already covered in `.gitignore`, but double check with `git status` before every push:

```
.env  .env.*  token.json  *.pem  *.key  credentials*.json  client_secret*.json
```

**Right after creating your `.env`**, lock it down so only you can read it:

```bash
chmod 600 .env
```

**If a token or secret ever leaks**, always revoke the real thing first (at the source — Slack app settings, GitHub settings, Google account permissions), then clean up git history after. Deleting a commit doesn't undo a leaked token — it's already out there until you revoke it.
