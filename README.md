# Discord Points Manager

A web dashboard for running points-based events in a Discord community. Staff create events, record each member's daily points week by week, and see who's leading. Every change is recorded in an audit log.

## What it does

### Events
- Create, edit and delete events. Each event has a name, description, month and type: **Game Night**, **Tournament**, **Challenge**, **Giveaway**, **Community** or **Other**.
- Events appear as colour-coded "pass" cards on the dashboard, one colour per type.
- Each event has its own workspace with a summary of its weeks and participants.

### Weekly points
- Points are tracked per participant, per week, with one value for each day of the week and a running total.
- A week is exactly the dates you pick under **Add Week**, from 1 to 7 days, starting on any day. A longer range is split into 7-day weeks from its first day, and the last one can be shorter.
- An event shows only the weeks you add (a new event starts with none). No week is added for you.
- A day can belong to only one week of an event, so dates already in a week can't be picked again. Past dates can be added too.
- Deleting a week removes it and all of its points for good, and frees its dates. It stays gone when you leave the page and come back, including with the browser's back button.
- Weeks are labelled by their place in the event, e.g. `Week 2 · Sep 21 - 25, 2026`. Deleting a week renumbers the others but never changes their dates.
- Editors can add or remove weeks, add participants, and set, change or clear any participant's points in a points table.

### Leaderboard
- Each event has a leaderboard that ranks participants by their total points across all of its weeks.

### Bulk import
- Load a whole roster of points at once from a **CSV** or **Excel (.xlsx)** file.
- Expected columns: `Discord Username`, a column for each day of the week (`Monday` through `Sunday`), and optionally `Total Points`. A value on a day that isn't part of the week is reported as a row problem.
- Rows are checked before anything is saved, and problems are reported row by row.

### Exports
- Export a week's points or an event's leaderboard as a CSV. Every role can export, including viewers.

### Team and roles
Staff sign in with an email and password. Each account has one role:

| Role | Can do |
| --- | --- |
| **Admin** | Everything, plus managing the team (add or remove members, change roles, reset passwords). |
| **Editor** | Create and change events, weeks, participants and points. |
| **Viewer** | Read-only, but can still export CSVs. |

The server enforces these permissions. The interface also hides controls a user can't use.

### Audit log
- The app records score changes, week changes, imports, participant additions, event changes, team changes and exports, along with who made each change and when.
- Admins can browse the log at `/dashboard/audit` and print it.

### Interface
- Light and dark themes, with a toggle.
- Times are shown in the viewer's local time zone.
- Loading, error and not-found screens throughout.

### Discord bot
- `/leaderboard` and `/user-stats` slash commands show the standings and a player's stats in Discord, per event, per week or per day, with buttons to page through long leaderboards.
- The bot lives in [`bot/`](bot/README.md) and runs as its own always-on Node.js process, not on Vercel. It reads the dashboard's read-only `/api/bot/*` routes.
- The bot API stays off until `BOT_API_SECRET` (32+ characters, e.g. from `openssl rand -base64 32`) is set in the dashboard's environment. The bot uses the same value. See [`bot/README.md`](bot/README.md) for setup.

## Built with

- **Next.js 16** (App Router) and **React 19**, written in TypeScript
- **Tailwind CSS 4** for styling
- **Supabase** (Postgres) for data storage
- **Upstash Redis** for login rate limiting
- **jose** for signed session cookies
- **PapaParse** and **SheetJS** for reading CSV and Excel files
- **discord.js** for the Discord bot

If no Supabase credentials are set, the app uses built-in sample data held in memory, so you can explore every feature without a backend. That sample data resets whenever the server restarts.

## Project layout

```
app/          Pages (login, dashboard, events, leaderboard, team, audit) and API routes
components/   UI, grouped into auth, common, dashboard and team
lib/          Auth, data access, validation, week math, import parsing, audit logging
types/        Shared TypeScript types
scripts/      Helper scripts (e.g. password hashing)
bot/          Discord bot, a separate Node.js package (see bot/README.md)
```
