# SETUP — myDashboard

Step-by-step setup for running this on your own machine.

Takes about 15–20 minutes, most of it spent clicking around Google and Slack's websites.

---

## 0. Before you start

You need Node.js version 20 or newer.

```bash
node -v
```

If it's older than that, update first (`brew install node` or nvm).

---

## 1. Google Cloud Console — turn on Gmail + Calendar access

Go to https://console.cloud.google.com

### Already have a Google Cloud project from something else?

You can reuse it — no need to create a new one. **Skip 1.1 entirely.** For 1.2 and 1.3, just check they're already set up the way you need.

| Step | If you already have a project connected to Gmail |
|---|---|
| 1.1 Create a project | Skip |
| 1.2 Enable Gmail API + Calendar API | Gmail's probably already on — check the button says "Manage", not "Enable". **Google Calendar API still needs turning on separately** |
| 1.3 Consent screen | Already set up, just check the 2 things below |
| 1.4 Create an OAuth client ID | **Do this one fresh, don't skip it** |

**Make a brand new OAuth client — don't edit your existing one.** Your old client is tied to that other app's redirect URI, and this one needs its own: `http://localhost:3000/auth/google/callback`.

You *could* add a second redirect URI to your existing client instead, but don't — if you ever revoke or rotate one side's secret, the other breaks too. Keeping them separate is cleaner and won't touch anything that's already working.

**Two things to check on the OAuth consent screen**

1. **Publishing status**
   - *Testing* → you'll need to add your own email under Test users, and the refresh token expires every 7 days
   - *In production* → better, since the token doesn't expire every 7 days. You'll just see an "unverified" warning when authorizing (click Advanced to get past it)

   ⚠️ Don't flip this status just for this project — the consent screen is shared across the whole Google Cloud project, so it affects your other app too.

2. **User Type has to be External** — if it's Internal, that means the project sits under a Workspace org and won't work with a regular `@gmail.com` account. In that case you really do need a new project.

**Don't worry about scopes clashing** — your other app might ask for `gmail.modify` or full access, while this dashboard only asks for `gmail.readonly` + `calendar.events` + `calendar.readonly`. They're requested separately and stored in a separate place (this project's own `token.json`), so nothing collides.

⚠️ **`calendar.events` is a "sensitive" scope** — when you click Allow, there's an extra screen asking for permission to "view and edit events on your calendar." Totally fine to use on your own account while still in Testing — no need to submit for verification.

### 1.1 Create a project

Top-left corner, click the project name → **New Project** → name it anything, like `myDashboard` → Create.

Wait a moment, then switch to the project you just made.

### 1.2 Turn on Gmail API + Google Calendar API

**APIs & Services → Library** → search `Gmail API` → click **Enable**.

Then go back to Library → search `Google Calendar API` → click **Enable**.

Forget the second one and the Calendar tab will show an error like `Google Calendar API has not been used in project … before or it is disabled`.

### 1.3 Set up the OAuth consent screen

> **There are two different Console UIs floating around** — if the left menu shows *Google Auth Platform* (Overview / Branding / Audience / Clients / Data Access), that's the newer one. Same stuff, different page names:
>
> | Old name | New name |
> |---|---|
> | OAuth consent screen | **Branding** (app name, email) |
> | Publishing status + Test users | **Audience** |
> | Credentials → OAuth client IDs | **Clients** |

**APIs & Services → OAuth consent screen** (or **Branding** on the new UI)

| Field | What to put |
|---|---|
| User Type | **External** |
| App name | `myDashboard` |
| User support email | your email |
| Developer contact | your email |

On the **Audience** page

- **Leave Publishing status as Testing** — no need to submit for verification, the trade-off is the refresh token expires every 7 days
- **Test users → + Add users** → add the email you'll use to open the dashboard (the Gmail account you actually want to see)

  > Don't skip this one — Google will reject you with `access_denied` during authorization if you do

- **Leave the Data Access page alone** — while in Testing, the code can request scopes directly at redirect time. Manually adding restricted scopes there can push the project into needing verification for no reason.

### 1.4 Create an OAuth client ID

**APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**

(New UI: **Clients → + Create client**)

| Field | What to put |
|---|---|
| Application type | **Web application** |
| Name | `myDashboard local` |
| Authorized redirect URIs | `http://localhost:3000/auth/google/callback` |

Click Create → a popup shows your **Client ID** and **Client secret** — keep it open, you'll paste these into `.env` in a bit.

> Closed the popup already? Go back into the client and download the JSON instead.

---

## 2. Slack — create an app to get a user token

Go to https://api.slack.com/apps

### 2.1 Create the app — shortcut using a manifest

**Create New App → From a manifest** → pick your workspace → **YAML** tab → delete what's there and paste this:

```yaml
display_information:
  name: myDashboard
  description: Reads DMs and channel activity into a personal dashboard
oauth_config:
  scopes:
    user:
      - channels:read
      - groups:read
      - im:read
      - channels:history
      - groups:history
      - im:history
      - users:read
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

→ Next → Create — this gives you all the scopes under `user` already. **You can skip step 2.2.**

`token_rotation_enabled: false` matters here — turn rotation on and your `xoxp-` token expires every 12 hours, needing code to refresh it, which `server/slack.js` doesn't have.

> The old **From scratch** button is now called **Blank app**. Use that one if you'd rather pick scopes yourself, then follow 2.2.

### 2.2 Requesting scopes manually (skip if you used the manifest)

Left menu **OAuth & Permissions** → scroll to **Scopes**.

⚠️ Add these under **User Token Scopes**, not Bot Token Scopes — the dashboard reads as you, not as a bot.

| Scope | What it's for |
|---|---|
| `channels:read` | list of public channels |
| `groups:read` | list of private channels |
| `im:read` | list of your DMs |
| `channels:history` | reading messages in public channels |
| `groups:history` | reading messages in private channels |
| `im:history` | reading DM messages |
| `users:read` | turning user IDs into actual names |

### 2.3 Install to your workspace

Scroll to the top → **Install to Workspace** → Allow.

You'll get a **User OAuth Token** starting with `xoxp-…` — copy it somewhere safe.

> If your workspace requires admin approval for apps, you'll see a pending message — you won't get the token until an admin approves it.
>
> This token can read anything your account can read, DMs included — never commit it or paste it anywhere public.

### 2.4 Connecting more than one workspace

A Slack user token only works for one workspace — no way around that. If you're part of multiple workspaces (say, your company's and an outside team's), repeat steps 2.1–2.3 **separately for each one** to get a token per workspace.

Put all of them into one variable, `SLACK_USER_TOKENS`, separated by commas, instead of `SLACK_USER_TOKEN`:

```
SLACK_USER_TOKENS=xoxp-workspace1-xxxxx,xoxp-workspace2-xxxxx
```

The dashboard pulls from every workspace and merges them, automatically prefixing channel names with the workspace name (like `po-develope/new-channel`) so channels with the same name across workspaces don't get mixed up.

> Prefixing workspace names needs one more scope — **`team:read`** — added to each app's User Token Scopes. Skip it and everything still works, just without the workspace name in front.

---

## 2.5 GitHub — create a personal access token

Go to https://github.com/settings/tokens → **Tokens (classic)** → **Generate new token (classic)**

| Field | What to put |
|---|---|
| Note | `myDashboard` |
| Expiration | whatever you're comfortable with (90 days, or No expiration) |
| Scopes | check **`read:user`** — also check **`repo`** if you want commits from private repos to show up too |

Click **Generate token** → copy the value starting with `ghp_` right away (you can't view it again once you leave the page).

> Uses the **GraphQL API** because the contribution calendar has no REST endpoint at all — the calendar and latest commits both come from a single query.
>
> `read:user` only lets it read your profile, nothing else. `repo` grants read **and write** access to private repos — the dashboard only ever reads, but classic GitHub tokens don't have a read-only option for private repos. Skip `repo` if that bothers you; you'll just only see public activity.

---

## 2.75 Discord — create a bot to pull channel messages

Discord doesn't have an official "user token" like Slack does — you have to use a **bot**, which is a separate account from you, so it can only read messages in channels it's been invited to. **It can't read your personal DMs.**

1. Go to https://discord.com/developers/applications → **New Application**, name it anything, like `myDashboard`
2. **Bot** tab (left side) → click **Reset Token**, copy the value (starts with something like `MTI...`)
3. Scroll down to **Privileged Gateway Intents** → turn on **MESSAGE CONTENT INTENT** and Save — skip this and every message comes through empty
4. **OAuth2 → URL Generator** tab → check the **`bot`** scope, then check **View Channel** and **Read Message History** permissions
5. Copy the generated link, open it in a browser, and pick the server you want to invite the bot to
6. Turn on **Developer Mode** in Discord (User Settings → Advanced → Developer Mode), then right-click each channel you want → **Copy Channel ID**

> Don't have any Discord you want to pull from? Skip this whole section — the Discord tab will just say it's not set up yet.

---

## 2.85 LINE — send yourself a daily summary

This one isn't a "connection" like the others — it's a button, **"Send summary to LINE now"**, on the "Connect more" tab. Clicking it bundles up your Inbox / today's plans / Slack messages into a short message and pushes it to your own LINE.

1. Go to https://developers.line.biz/console/ → pick a Provider → pick a **Messaging API** Channel
   (already have a LINE bot from something else? reuse that same channel, no need for a new one)
2. **Basic settings** tab → scroll to **Channel access token** → click **Issue** (or copy the one already issued)
3. Same tab, scroll to **"Your user ID"** — if you're logged into the console with your own personal LINE account, this is your own User ID (different from the bot's User ID)

> Don't want this feature? Skip it — the button just won't show up if it's not configured.

---

## 3. Fill in `.env`

```bash
cd myDashboard
cp .env.example .env
```

Open `.env` and fill in the values:

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
SLACK_USER_TOKEN=xoxp-xxxxx
GITHUB_TOKEN=ghp_xxxxx
DISCORD_BOT_TOKEN=MTIzxxxxx
DISCORD_CHANNEL_IDS=123456789012345678,987654321098765432
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
LINE_USER_ID=Uxxxxx
PORT=3000
HOST=127.0.0.1
```

None of these depend on each other — fill in whatever you have for now. Any tab without a token will just tell you what's missing.

`.env` is already in `.gitignore`, so it won't end up on git.

---

## 4. Run it

```bash
npm install
npm run build   # builds the web app (React) — run again anytime code in web/ changes
npm start
```

You should see:

```
  myDashboard  →  http://localhost:3000
```

Open your browser to http://localhost:3000

### First time

The Mailbox tab will show a **Connect Gmail** button — click it and pick your account.

- See **"Google hasn't verified this app"**? Click **Advanced → Go to myDashboard (unsafe)** — normal, since the app's still in Testing and it's your own app
- Click Continue to grant Gmail read access
- Back on the "Connected!" page → click the link back to the dashboard

Slack needs no clicking — it just uses the token straight from `.env`.

---

## 5. Check that it's working

```bash
curl -s localhost:3000/api/status
```

Should return `{"gmail":true,"calendar":true,"slack":true,"github":true,"discord":true,"line":true}`

```bash
curl -s localhost:3000/api/mail/summary | head -c 300
curl -s localhost:3000/api/slack | head -c 300
```

---

## 6. Deploying publicly — turn on login to keep others out

As long as this only ever runs on `localhost` (the default), skip this whole section — only your own machine can reach it anyway.

But if you're putting it on a real domain so it's reachable from anywhere, **you need login turned on first** — otherwise anyone with the URL can see your real email and Slack instantly.

This login system is completely separate from the OAuth that reads Gmail/Calendar — it's just checking "who's opening this page" by having them log in with Google (it doesn't ask for any permission on the account that logs in), then only letting them through if the email matches yours.

1. Back in Google Cloud Console → your existing OAuth client (the one from step 1) → **Authorized redirect URIs** → add
   `https://<your-domain>/auth/site/callback` (still testing locally too? also add `http://localhost:3000/auth/site/callback`)
2. Generate a random `SESSION_SECRET` (used to sign cookies, so nobody can fake a session):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Fill these into `.env`:
   ```
   ALLOWED_EMAIL=your@email.com
   SESSION_SECRET=<the value you just generated>
   SITE_REDIRECT_URI=https://<your-domain>/auth/site/callback
   ```
4. Restart the server — now any page redirects to `/login` first. You'll need to click "Log in with Google" and log in with the exact email that matches `ALLOWED_EMAIL` to see the dashboard. Anyone else who logs in with their own account gets a "no access" page.

> Delete `ALLOWED_EMAIL`/`SESSION_SECRET` from `.env` any time to turn login back off and go back to local mode (handy for development on your own machine).

---

## Common problems

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` | The URI in Google Console doesn't exactly match `GOOGLE_REDIRECT_URI` — has to match character-for-character, including `http://` and no trailing `/` |
| `access_denied` while authorizing | You haven't added your own email under Test users yet |
| `/api/status` returns `gmail:false` right after authorizing | `token.json` failed to write — check the folder's write permissions |
| `slack …: missing_scope (requires scope: …)` | The missing scope is named in the error — add it under **User Token Scopes**, then **Reinstall to Workspace** (the old token stops working, you need to copy the new one) |
| `invalid_auth` | Wrong or expired token, or you accidentally used a Bot token (`xoxb-`) instead of a user token (`xoxp-`) |
| `GITHUB_TOKEN` doesn't work | Token expired or wasn't copied fully — generate a new one at github.com/settings/tokens |
| GitHub tab is empty even with a token set | Token is missing the `read:user` scope — just edit the existing token's scopes, no need to make a new one |
| Calendar tab says the token predates the calendar feature | Your existing `token.json` was issued back when it only asked for Gmail scope — click **Grant calendar access** on that tab (or "Connect more") and approve once, no need to delete `token.json` yourself |
| Some calendars don't show up | The dashboard only pulls calendars that are **checked/visible** in Google Calendar — check the box on the Google Calendar website, then wait for the calendar-list cache to expire (10 minutes) or restart the server |
| Events show up 7 hours off | `CALENDAR_TZ` in `.env` doesn't match your actual timezone — fix it and restart |
| Clicking "Save" shows "no permission to edit" | That calendar was shared with you as read-only (like a holidays calendar) — you can only edit calendars you own or have write access to |
| Gmail access drops every 7 days | OAuth consent screen is in Testing status → refresh token expires every 7 days. Click **Publish app** if you want it to last longer (you'll get an unverified warning, but it still works) |
| `/api/slack` is really slow | It calls `conversations.history` per channel, capped at 25 channels — results are cached for 60 seconds, so the second load is fast |
| Want to disconnect Gmail | "Connect more" tab → **Disconnect** button (deletes `token.json`) |
| Discord tab shows empty messages even with a token | Forgot to turn on **MESSAGE CONTENT INTENT** in the Bot tab of the Discord Developer Portal — message content comes through blank without it |
| `/api/discord` error `403` / `50001 Missing Access` | The bot hasn't been invited to that channel, or `DISCORD_CHANNEL_IDS` has a wrong ID — re-invite the bot with the OAuth2 link and double-check the IDs |
| Sending a LINE summary gives `line push: 401` | `LINE_CHANNEL_ACCESS_TOKEN` is wrong or expired — issue a new one in the LINE Developers Console |
| Sending a LINE summary gives `line push: 400` | `LINE_USER_ID` is malformed or doesn't match the account — check "Your user ID" under Basic settings again (should start with `U`) |
| Logging in gives `redirect_uri_mismatch` | Forgot to add `/auth/site/callback` to Authorized redirect URIs in Google Cloud Console — has to match `SITE_REDIRECT_URI` character-for-character |
| Login works but shows "no access" | The email you logged in with doesn't match `ALLOWED_EMAIL` in `.env` (case doesn't matter, but it has to be the same email) |
| Want to turn login off, back to local mode | Delete `ALLOWED_EMAIL` or `SESSION_SECRET` from `.env` and restart — access opens back up immediately |
