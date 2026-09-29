# Discord Points Manager

A web dashboard for running points-based events in a Discord community. Staff create events, record each member's daily points week by week, and see who's leading. Every change is recorded in an audit log.

## What it does

### Events
- Create, edit and delete events. Each event has a name, description, month and type: **Game Night**, **Tournament**, **Challenge**, **Giveaway**, **Community** or **Other**.
- Events appear as colour-coded "pass" cards on the dashboard, one colour per type.
- Each event has its own workspace with a summary of its weeks and participants.

### Weekly points
- Points are tracked per participant, per week, with one value for each day (Monday–Sunday) and a running total.
- Weeks always start on a Monday. Whatever date you pick is moved back to that week's Monday.
- Weeks are labelled by their place in the event, e.g. `Week 2 · Sep 21 - 27, 2026`.
- Editors can add or remove weeks, add participants, and set, change or clear any participant's points in a points table.

### Leaderboard
- Each event has a leaderboard that ranks participants by their total points across all of its weeks.

### Bulk import
- Load a whole roster of points at once from a **CSV** or **Excel (.xlsx)** file.
- Expected columns: `Discord Username`, `Monday` through `Sunday`, and optionally `Total Points`.
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

## Built with

- **Next.js 16** (App Router) and **React 19**, written in TypeScript
- **Tailwind CSS 4** for styling
- **Supabase** (Postgres) for data storage
- **Upstash Redis** for login rate limiting
- **jose** for signed session cookies
- **PapaParse** and **SheetJS** for reading CSV and Excel files

If no Supabase credentials are set, the app uses built-in sample data held in memory, so you can explore every feature without a backend. That sample data resets whenever the server restarts.

## Project layout

```
app/          Pages (login, dashboard, events, leaderboard, team, audit) and API routes
components/   UI, grouped into auth, common, dashboard and team
lib/          Auth, data access, validation, week math, import parsing, audit logging
types/        Shared TypeScript types
scripts/      Helper scripts (e.g. password hashing)
```
