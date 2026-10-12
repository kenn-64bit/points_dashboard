# Discord Bot: Run and Deploy Guide

How to run the Discord Points Bot, what it needs, and how to deploy it next to the dashboard that's already running on Vercel.

| | Version |
| --- | --- |
| This guide | **1.0.0** (2026-10-08) |
| Bot (`bot/package.json`) | **0.1.0** |
| Dashboard (`package.json`) | **0.1.0** |
| Node.js for the bot | **22.18 or later** |
| discord.js | **14.27** |

For the slash commands and their options, see [`bot/README.md`](bot/README.md).

---

## Contents

1. [How it fits together](#1-how-it-fits-together)
2. [Requirements](#2-requirements)
3. [One-time Discord setup](#3-one-time-discord-setup)
4. [Run the bot locally](#4-run-the-bot-locally)
5. [Deploy with the running Vercel app](#5-deploy-with-the-running-vercel-app)
6. [Updating](#6-updating)
7. [Versioning](#7-versioning)
8. [Troubleshooting](#8-troubleshooting)
9. [Changelog](#9-changelog)

---

## 1. How it fits together

```
Discord  ⇄  bot (bot/, on an always-on host)  →  https://your-app.vercel.app/api/bot/*  →  Supabase
```

- The **dashboard** stays on Vercel. It also serves a read-only bot API under `/api/bot/*`.
- The **bot** is a separate Node.js process. It has to stay connected to Discord's gateway all the time, so it **can't run on Vercel**: serverless functions stop after each request. It runs on its own host instead (Railway, Render, a VPS, and so on).
- The two share one secret, `BOT_API_SECRET`. The bot sends it with every request. Until the dashboard has it, every `/api/bot/*` route answers `503` and the rest of the dashboard works as usual.
- Vercel never builds the bot: `bot/` is listed in `.vercelignore` and excluded in the root `tsconfig.json`.

---

## 2. Requirements

### Software

| What | Version | Why |
| --- | --- | --- |
| Node.js | 22.18+ | The bot runs its TypeScript files directly (Node's type stripping), so there's no build step. Older Node versions can't do this. |
| npm | Comes with Node | Installs dependencies and runs the scripts. |
| Git | Any | To get the code onto the host. |
| OpenSSL (or any password generator) | Any | To make `BOT_API_SECRET`. |

Check your versions:

```bash
node --version   # v22.18.0 or later
npm --version
```

Bot dependencies (installed by `npm install` / `npm ci` in `bot/`):

| Package | Version | Used for |
| --- | --- | --- |
| `discord.js` | ^14.27.0 | Talking to Discord |
| `typescript` | ^5.9 (dev only) | `npm run typecheck`. Not needed to run the bot. |
| `@types/node` | ^22 (dev only) | Type checking |

### Accounts and access

- **The dashboard deployed on Vercel**, with Supabase set up. Without Supabase, the dashboard falls back to in-memory sample data, which doesn't persist on Vercel, so the bot would have nothing real to show.
- **Access to the Vercel project's settings**, to add an environment variable and redeploy.
- **A Discord account with Manage Server permission** on the server where the bot will live.
- **An always-on host** for the bot: Railway, a Render background worker, Fly.io, or a VPS. It only makes outgoing connections, so it doesn't need a public URL or open port.

### Configuration

The bot reads these environment variables. Locally they go in `bot/.env`; on a host, set them in the host's settings.

| Variable | Required | Example | Meaning |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | `MTI3...` | The bot's token from the Discord Developer Portal. |
| `DISCORD_CLIENT_ID` | Only for `deploy-commands` | `1270000000000000000` | The application ID. |
| `DISCORD_GUILD_ID` | No | `1180000000000000000` | The server to register commands in. Empty registers them globally. |
| `DASHBOARD_API_URL` | Yes | `https://your-app.vercel.app` | The dashboard's **production** address. |
| `BOT_API_SECRET` | Yes | (32+ characters) | Must be identical to the dashboard's `BOT_API_SECRET`. |
| `BOT_TIMEZONE` | No | `Asia/Manila` | Decides what "today" means. Default `UTC`. |
| `API_TIMEOUT_MS` | No | `8000` | How long to wait for the dashboard, 1000–60000 ms. Default `8000`. |

The dashboard needs one extra variable on Vercel:

| Variable | Where | Meaning |
| --- | --- | --- |
| `BOT_API_SECRET` | Vercel → Settings → Environment Variables | Turns on `/api/bot/*`. At least 32 characters. |

---

## 3. One-time Discord setup

1. Go to <https://discord.com/developers/applications> and choose **New Application**.
2. **Bot** tab:
   - Choose **Reset Token** and copy it. This is `DISCORD_TOKEN`. Keep it secret.
   - Turn off **Public Bot**, so only you can add it to servers.
   - Leave all **Privileged Gateway Intents** off. The bot doesn't need them.
3. **General Information** tab: copy the **Application ID**. This is `DISCORD_CLIENT_ID`.
4. Invite the bot to your server. Open this URL with your application ID filled in:

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot+applications.commands&permissions=19456
   ```

   `19456` grants View Channels, Send Messages and Embed Links.
5. Get your server ID for `DISCORD_GUILD_ID`: in Discord, turn on **Settings → Advanced → Developer Mode**, then right-click the server and choose **Copy Server ID**.

---

## 4. Run the bot locally

You can point a local bot at either a local dashboard or the live Vercel one.

### Option A: against a local dashboard

In the repo root:

```bash
openssl rand -base64 32          # copy the output
echo 'BOT_API_SECRET=PASTE_IT_HERE' >> .env.local
npm install
npm run dev                      # dashboard on http://localhost:3000
```

Without Supabase settings, the local dashboard uses in-memory data that starts empty. Sign in as `admin@example.com` / `admin`, create an event and import a points file so the bot has something to show.

In a second terminal:

```bash
cd bot
cp .env.example .env
```

Fill in `bot/.env`:

```env
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-id
DISCORD_GUILD_ID=your-server-id
DASHBOARD_API_URL=http://localhost:3000
BOT_API_SECRET=the-same-value-as-in-.env.local
BOT_TIMEZONE=Asia/Manila
```

Then:

```bash
npm install
npm run deploy-commands   # registers /leaderboard and /user-stats
npm run dev               # runs the bot, restarts on file changes
```

### Option B: against the live Vercel dashboard

Do [step 5.1](#51-turn-on-the-bot-api-on-vercel) first, then use the same `bot/.env` as above with:

```env
DASHBOARD_API_URL=https://your-app.vercel.app
BOT_API_SECRET=the-value-you-set-on-vercel
```

### It's working when

The bot prints:

```
[bot] Logged in as Points Bot#1234, in 1 server(s)
[bot] Dashboard API OK at https://your-app.vercel.app: 4 events, 37 players
```

and `/leaderboard` answers in your server.

### Bot scripts

| Command (in `bot/`) | What it does |
| --- | --- |
| `npm start` | Runs the bot. |
| `npm run dev` | Runs the bot and restarts it when a file changes. |
| `npm run deploy-commands` | Registers the slash commands with Discord. |
| `npm run deploy-commands -- --dry-run` | Prints the commands without registering anything. |
| `npm run typecheck` | Type-checks the code. |

---

## 5. Deploy with the running Vercel app

The order matters: turn on the API, check it, register the commands, then start the hosted bot.

### 5.1 Turn on the bot API on Vercel

1. Generate a secret:

   ```bash
   openssl rand -base64 32
   ```

2. Add it to the Vercel project, either in the dashboard:
   **Project → Settings → Environment Variables → Add** → name `BOT_API_SECRET`, value from step 1, environment **Production**.

   or with the Vercel CLI from the repo root:

   ```bash
   vercel env add BOT_API_SECRET production
   ```

3. **Redeploy.** Vercel only applies environment variables to new deployments.
   **Deployments → latest production deployment → ⋯ → Redeploy**, or `vercel --prod`.

### 5.2 Check that the bot API answers

```bash
curl -i -H "Authorization: Bearer YOUR_SECRET" https://your-app.vercel.app/api/bot/events
```

| Response | Meaning |
| --- | --- |
| `200` with `{"events":[...]}` | Ready. |
| `503` `"The bot API is not configured."` | The secret isn't on this deployment. Redeploy after adding it. |
| `401` `"Invalid bot token"` | The secret you sent doesn't match. |
| A redirect to `vercel.com` | You used a protected preview URL. Use the production domain. |

### 5.3 Register the slash commands

This is a one-off call to Discord, so run it from your own machine. It doesn't need to run on the host.

```bash
cd bot
npm run deploy-commands
# Registered 2 commands in server 1180000000000000000.
```

Run it again whenever a command or its options change, not on every deploy.

### 5.4 Deploy the bot to an always-on host

Whichever host you pick:

- **Root directory:** `bot`
- **Install:** `npm ci`
- **Start:** `npm start`
- **Variables:** everything from [Configuration](#configuration), with `DASHBOARD_API_URL` set to the Vercel production address. No `.env` file is needed on the host.
- **Copies:** exactly **one**. Stop your local bot first. Two copies with the same token both try to answer every command.

#### Railway

1. **New Project → Deploy from GitHub repo**, and pick this repository.
2. In the service's **Settings**, set **Root Directory** to `bot`. Railway detects Node and reads the version from `engines` in `bot/package.json`.
3. Set the **Start Command** to `npm start` if it isn't detected.
4. In **Variables**, add the bot's environment variables.
5. Deploy. The bot needs no public domain, so leave networking off.

#### Render

1. **New → Background Worker** (not a Web Service: the bot doesn't listen on a port), and connect this repository.
2. **Root Directory:** `bot`. **Build Command:** `npm ci`. **Start Command:** `npm start`.
3. Under **Environment**, add the bot's variables plus `NODE_VERSION=22.18.0` (or later).
4. Create the worker.

#### VPS with pm2

```bash
git clone YOUR_REPO_URL points_dashboard
cd points_dashboard/bot
npm ci
cp .env.example .env && nano .env    # fill in the production values

npm install -g pm2
pm2 start npm --name points-bot -- start
pm2 save
pm2 startup     # prints one command to run, so the bot starts again after a reboot
```

Logs: `pm2 logs points-bot`.

#### VPS with systemd

Create `/etc/systemd/system/points-bot.service`, using the path from `which node`:

```ini
[Unit]
Description=Discord Points Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pointsbot
WorkingDirectory=/opt/points_dashboard/bot
ExecStart=/usr/bin/node --env-file=.env src/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now points-bot
journalctl -u points-bot -f     # logs
```

### 5.5 Check the deployment

1. The host's logs show `Logged in as ...` and `Dashboard API OK at https://your-app.vercel.app: ...`.
2. `/leaderboard` in Discord shows the same standings as the dashboard's leaderboard page.
3. `/user-stats` with no options shows your own stats, if your dashboard name matches your Discord name.

---

## 6. Updating

### Bot code changes

- **Railway / Render:** push to the branch the host watches. It reinstalls and restarts the bot.
- **VPS:**

  ```bash
  cd points_dashboard && git pull
  cd bot && npm ci
  pm2 restart points-bot          # or: sudo systemctl restart points-bot
  ```

- If a command or its options changed, run `npm run deploy-commands` once as well.

### Changes to the bot API

The bot and the dashboard deploy separately. `bot/src/api/types.ts` is a copy of the bot API types in the dashboard's `types/index.ts`, so change both together, then:

1. Deploy the **dashboard** first (push to Vercel).
2. Then deploy the **bot**.

If they get out of step, the bot logs "Unexpected response ... Are the bot and the dashboard on matching versions?"

### Rotating `BOT_API_SECRET`

1. Generate a new secret.
2. Update it on Vercel and redeploy.
3. Update it on the bot's host and restart the bot.

Between steps 2 and 3, commands answer with "I'm not set up to read the points dashboard". Do the two steps close together.

---

## 7. Versioning

The bot and the dashboard each have their own version, in semver form (`MAJOR.MINOR.PATCH`):

| Part | Where the version lives |
| --- | --- |
| Bot | `version` in `bot/package.json`, and `USER_AGENT` in `bot/src/api/client.ts` (`discord-points-bot/0.1`) |
| Dashboard | `version` in the root `package.json` |
| This guide | The table at the top of this file and the [Changelog](#9-changelog) |

See the current versions:

```bash
npm pkg get version                       # dashboard, from the repo root
npm --prefix bot pkg get version          # bot
```

### Releasing a new bot version

1. Bump the version without creating a git tag for the whole repo:

   ```bash
   cd bot
   npm version patch --no-git-tag-version   # bug fix:         0.1.0 → 0.1.1
   npm version minor --no-git-tag-version   # new feature:     0.1.0 → 0.2.0
   npm version major --no-git-tag-version   # breaking change: 0.1.0 → 1.0.0
   ```

2. Update `USER_AGENT` in `bot/src/api/client.ts` to match.
3. Update the version table at the top of this guide and add a [Changelog](#9-changelog) entry.
4. Commit, and optionally tag the release so it's easy to find later:

   ```bash
   git tag bot-v0.2.0
   ```

5. Deploy as in [Updating](#6-updating).

---

## 8. Troubleshooting

| What you see | Likely cause and fix |
| --- | --- |
| `BOT_API_SECRET is not set` (bot exits at start) | The variable is missing on the host, or `bot/.env` is missing locally. |
| `BOT_API_SECRET must be at least 32 characters` | Generate one with `openssl rand -base64 32`. |
| `Couldn't log in to Discord. Check DISCORD_TOKEN.` | The token is wrong or was reset. Copy a fresh one from the Bot tab. |
| "I'm not set up to read the points dashboard" | `BOT_API_SECRET` is missing on Vercel (redeploy after adding it) or doesn't match the bot's. The bot's log says which. |
| "I can't reach the points dashboard" / "taking too long" | `DASHBOARD_API_URL` is wrong, or the dashboard is down or slow. Try the `curl` check in [5.2](#52-check-that-the-bot-api-answers). |
| Log says `redirected to ...` | `DASHBOARD_API_URL` isn't the dashboard's own `https://` production address, or points at a protected preview deployment. |
| Log says `No bot API at ... (HTTP 404)` | The Vercel deployment predates the bot routes, or the URL is wrong. Redeploy the dashboard from the current code. |
| Commands don't appear in Discord | Run `npm run deploy-commands`, then reload Discord (Ctrl+R). |
| "The application did not respond" | The bot isn't running, or two copies are. |
| "I couldn't find you on the dashboard" | Your dashboard name doesn't match your Discord username, display name or server nickname. Use the `player` option. |
| `SyntaxError` or "Unknown file extension .ts" at start | Node is older than 22.18. Upgrade Node on the host. |

More: [`bot/README.md`](bot/README.md#troubleshooting).

---

## 9. Changelog

### Guide 1.0.0 (2026-10-08)

- First version. Covers bot 0.1.0 (`/leaderboard`, `/user-stats`) and dashboard 0.1.0.
- Requirements, Discord setup, running locally, deploying with the Vercel dashboard (Railway, Render, pm2, systemd), updating, versioning and troubleshooting.
