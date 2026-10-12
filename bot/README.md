# Discord Points Bot

Slash commands that bring the Discord Points Manager's leaderboards into Discord.

- `/leaderboard [event] [timeframe] [date]` shows the standings, 10 players a page, with buttons to page through them.
- `/user-stats [player] [event] [timeframe] [date]` shows one player's points, rank and active days, and where the points came from. Without `player`, it shows your own.

| Option | What it does |
| --- | --- |
| `event` | Pick an event from the list, or **All events**. Default: the latest event, meaning the one with the most recent week of points. |
| `timeframe` | **Per event** (all weeks; the default), **Per week** or **Per day**. |
| `date` | For a week or a day: `YYYY-MM-DD`, `today` or `yesterday`. Any day selects the event's week that includes it (for all events, each event's own week). Default: today in `BOT_TIMEZONE`. |
| `player` | Pick from the list or type a name. Default: you, matched by your Discord username, display name or server nickname. |

Players tied on points share a rank (1, 2, 2, 4). Players with no points in the period aren't listed. Replies are public; errors are shown only to the person who ran the command. Only that person can turn a leaderboard's pages.

## How it works

The bot is a separate, always-on Node.js process built on discord.js. It reads the dashboard's read-only bot API over HTTPS:

```
Discord ⇄ bot (this folder, on your host) → https://your-dashboard/api/bot/* → Supabase
```

The bot can't run on Vercel: serverless functions don't stay connected to Discord's gateway. Vercel keeps serving the dashboard and its API.

The API is protected by a shared secret, `BOT_API_SECRET`, set to the same value on the dashboard and on the bot. Until the dashboard has the secret, the bot API answers 503 and the rest of the dashboard works as before.

| Route | Returns |
| --- | --- |
| `GET /api/bot/events` | Every event, newest first |
| `GET /api/bot/players` | Every player, A→Z |
| `GET /api/bot/leaderboard?event_id=&timeframe=&date=` | Standings; `event_id` is an event id or `all`, and left out means the latest event |
| `GET /api/bot/user-stats?player=&event_id=&timeframe=&date=` | One player's points, rank and breakdown |

## Setup

You need Node.js 22.18 or later. Node runs the TypeScript directly, so there's no build step.

### 1. Turn on the bot API in the dashboard

1. Generate a secret: `openssl rand -base64 32`
2. In Vercel, open the project's **Settings → Environment Variables**, add `BOT_API_SECRET` with that value, and redeploy. For local development, put it in the dashboard's `.env.local` instead.

### 2. Create the Discord application

1. Go to <https://discord.com/developers/applications> and choose **New Application**.
2. Under **Bot**, choose **Reset Token** and copy the token. Turn off **Public Bot**, so only you can add it to servers. The bot doesn't need any privileged intents.
3. Under **General Information**, copy the **Application ID**.
4. Invite the bot to your server by opening this URL with your application ID filled in. It asks for View Channels, Send Messages and Embed Links.

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot+applications.commands&permissions=19456
   ```

### 3. Configure and run

```bash
cd bot
cp .env.example .env      # then fill it in
npm install
npm run deploy-commands   # once, and again whenever the commands change
npm start
```

`npm run deploy-commands` registers the commands in the server set by `DISCORD_GUILD_ID`, where they show up straight away. Leave `DISCORD_GUILD_ID` empty to register them globally, for every server the bot is in.

| Variable | Required | Meaning |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | The bot's token. |
| `DISCORD_CLIENT_ID` | For `deploy-commands` | The application ID. |
| `DISCORD_GUILD_ID` | No | The server to register the commands in. Empty registers them globally. |
| `DASHBOARD_API_URL` | Yes | The dashboard's address, e.g. `https://your-app.vercel.app`. |
| `BOT_API_SECRET` | Yes | The same value as the dashboard's `BOT_API_SECRET`. 32+ characters. |
| `BOT_TIMEZONE` | No | The time zone that decides what "today" is, e.g. `Asia/Manila`. Default `UTC`. |
| `API_TIMEOUT_MS` | No | How long to wait for the dashboard, in milliseconds. Default `8000`. A request that times out or can't connect is retried once. |

## Hosting

Any host that keeps a Node.js 22.18+ process running works: Railway, a Render background worker, Fly.io, or a VPS with pm2 or systemd. Point the host at the `bot` folder, install with `npm ci`, start with `npm start`, and set the variables above in the host's settings (no `.env` file needed there).

Run exactly one copy. Two copies would both try to answer every command.

## Development

- `npm run dev` restarts the bot whenever a file changes.
- `npm run typecheck` type-checks the code.
- `npm run deploy-commands -- --dry-run` prints the command definitions without registering anything.
- To work against a local dashboard, start it with `npm run dev` in the repo root. Without Supabase settings it uses an in-memory database that starts empty and resets when the server restarts: sign in as `admin@example.com` / `admin`, create an event and import a points file to have something to show. Set the same `BOT_API_SECRET` in the root `.env.local` and in `bot/.env`, and set `DASHBOARD_API_URL=http://localhost:3000`.

`src/api/types.ts` is a copy of the bot API types in the dashboard's `types/index.ts`, so the bot can deploy on its own. Change both together.

## Troubleshooting

| What you see | Likely cause |
| --- | --- |
| "I'm not set up to read the points dashboard" | `BOT_API_SECRET` is missing on the dashboard (redeploy after adding it) or doesn't match the bot's. The bot's log says which. |
| "I can't reach the points dashboard" or "taking too long" | `DASHBOARD_API_URL` is wrong, or the dashboard is down or slow. |
| The log says "redirected to …" | `DASHBOARD_API_URL` isn't the dashboard's own `https://` address, or it points at a protected Vercel preview deployment. Use the production domain. |
| The commands don't appear | Run `npm run deploy-commands`, then reload Discord (Ctrl+R). |
| "I couldn't find you on the dashboard" | Your name on the dashboard doesn't match your Discord username, display name or server nickname. Use the `player` option. |
| "The application did not respond" | The bot isn't running, or two copies are. |
