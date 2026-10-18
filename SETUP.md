# Local Development Setup

**Quick Start**: `npm install` → `npm run dev` → [http://localhost:3000](http://localhost:3000)

---

## ✓ Check You Have

```bash
node --version    # Need 18.17+
npm --version     # Need 9+
```

---

## 1️⃣ Install

```bash
npm install
```

**Done?** Move to step 2.

---

## 2️⃣ Pick Your Setup

### 🚀 Easiest (No Backend Needed)
Just run the app. Uses fake data in memory.
- Data resets when server restarts.

### 🗄️ Better (With Supabase)
Real database. Data persists.

1. Go to [supabase.com](https://supabase.com) → create project
2. Copy your URL and Anon Key
3. Create `.env.local` in project root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 🔒 Optional (Add Rate Limiting)
Prevent brute-force login attacks.

1. Go to [upstash.com](https://upstash.com) → create Redis
2. Add to `.env.local`:
   ```
   UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

### 🤖 Optional (Discord Bot API)
Required for the Discord bot route (`/api/bot/leaderboard`). Without it, every bot request is refused (401).

1. Generate a random key (32+ characters):
   ```bash
   openssl rand -hex 32
   ```
2. Add to `.env.local`, and in Vercel under Project → Settings → Environment Variables (then redeploy):
   ```
   BOT_API_KEY=your-random-key
   ```
3. The bot sends it as `Authorization: Bearer <BOT_API_KEY>`. Never give the bot the Supabase service role key.

---

## 3️⃣ Run It

### Development (with hot reload)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Production
```bash
npm run build
npm start
```

---

## 🔐 Login Credentials

**Using fake data:**
- Email: `admin@example.com`
- Password: `admin123`

**Using Supabase:**
Generate a password hash, then add user to database:
```bash
npm run hash-password
```

---

## 📋 All Commands

| Command | What it does |
|---------|---|
| `npm run dev` | Dev server (changes reload instantly) |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | Check code quality |
| `npm run hash-password` | Hash a password |

---

## 🆘 Stuck?

### Port 3000 taken?
```bash
npm run dev -- -p 3001
```

### Dependencies broken?
```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors?
```bash
npm install typescript@latest
```

### `.env.local` not working?
- File must be in **project root** (top level)
- Restart the dev server after changing it

---

## 📂 Where's What?

```
app/        → Pages & API
components/ → UI parts
lib/        → Logic & auth
types/      → TypeScript stuff
scripts/    → Tools
public/     → Images & static files
```

---

## 🎯 Next

1. Start the dev server
2. Log in
3. Create an event
4. Add points to test it
