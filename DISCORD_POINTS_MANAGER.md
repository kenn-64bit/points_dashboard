# Discord Points Manager - Admin Dashboard
## Technical Documentation & Setup Guide

---

## 📋 Overview

**Discord Points Manager** is a lightweight dashboard for tracking Discord user points across multiple weekly events. Built for Vercel + Supabase deployment with real-time point editing, leaderboards, rankings, and CSV export.

**Stack:** Next.js 14 | React 18 | TailwindCSS | Supabase PostgreSQL | Vercel

---

## 🎯 Core Features

### ✅ Implemented
- **Admin Dashboard** – Secure data management interface
- **Multiple Events** – Create, edit, delete events dynamically
- **Weekly Point Tracking** – Monday–Sunday per event per user
- **Manual Point Entry** – Edit points per day for each user
- **Bulk CSV/Excel Import** – Upload .csv or .xlsx to auto-add users and points
- **Leaderboards** – Ranked view with total points, badges for top 3
- **Rankings Display** – Position, username, total points, participation count
- **CSV Export** – Export weekly data by event for archival/analysis
- **Month-Based Organization** – Auto-group data by creation month
- **Responsive Design** – Mobile-friendly admin dashboard
- **Island Design System + Day/Night Themes** – Warm, ACNH-inspired UI with a light/dark switch; see [DESIGN.md](DESIGN.md)
- **Data Persistence** – All changes saved to Supabase in real-time

### 📊 Data Model
```
Users (Discord)
├── discord_id (PK)
├── discord_username
├── email
└── created_at

Events
├── event_id (PK)
├── event_name
├── created_at
└── month (YYYY-MM for grouping)

Points
├── point_id (PK)
├── event_id (FK)
├── discord_id (FK)
├── monday through sunday (integer)
├── total_points (computed)
└── week_date (YYYY-MM-DD)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- GitHub account (for Vercel)
- Supabase account (free tier)

### 1️⃣ Supabase Setup

**Create Database & Tables:**

```sql
-- Create users table
CREATE TABLE users (
  discord_id TEXT PRIMARY KEY,
  discord_username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create events table
CREATE TABLE events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  month TEXT GENERATED ALWAYS AS (to_char(created_at, 'YYYY-MM')) STORED
);

-- Create points table
CREATE TABLE points (
  point_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  monday INTEGER DEFAULT 0,
  tuesday INTEGER DEFAULT 0,
  wednesday INTEGER DEFAULT 0,
  thursday INTEGER DEFAULT 0,
  friday INTEGER DEFAULT 0,
  saturday INTEGER DEFAULT 0,
  sunday INTEGER DEFAULT 0,
  week_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, discord_id, week_date)
);

-- No RLS policies needed - direct data access
```

**Get Supabase Credentials:**
- Go to Supabase Dashboard → Project Settings → API
- Copy: `SUPABASE_URL` and `SUPABASE_ANON_KEY`

---

### 2️⃣ Environment Setup

**Create `.env.local`:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# CSV/Excel Import Settings
NEXT_PUBLIC_MAX_IMPORT_SIZE=5242880  # 5MB in bytes
NEXT_PUBLIC_ALLOWED_FILE_TYPES=.csv,.xlsx,.xls
```

---

### 3️⃣ Installation & Local Development

```bash
# Clone repo or initialize new Next.js project
npx create-next-app@latest discord-points-manager --typescript --tailwind

cd discord-points-manager

# Install dependencies
npm install @supabase/supabase-js papaparse xlsx

# Create file structure (see section below)

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## 📁 File Structure

```
discord-points-manager/
├── app/
│   ├── api/
│   │   ├── events/
│   │   │   ├── route.ts (GET, POST events)
│   │   │   └── [eventId]/route.ts (PUT, DELETE event)
│   │   ├── users/
│   │   │   ├── route.ts (GET users, POST new user)
│   │   │   └── bulk-import/route.ts (CSV/Excel bulk import)
│   │   └── points/
│   │       ├── route.ts (GET points, POST new entry)
│   │       └── [pointId]/route.ts (PUT update points)
│   ├── dashboard/
│   │   ├── page.tsx (Main admin dashboard)
│   │   ├── events/
│   │   │   └── [eventId]/page.tsx (Event detail view)
│   │   ├── leaderboard/
│   │   │   └── [eventId]/page.tsx (Leaderboard view)
│   │   └── export/
│   │       └── [eventId]/page.tsx (Export CSV)
│   ├── layout.tsx
│   ├── page.tsx (Dashboard home)
│   └── globals.css
├── components/
│   ├── dashboard/
│   │   ├── EventsList.tsx
│   │   ├── PointsTable.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── PointsEditor.tsx
│   │   ├── ExportButton.tsx
│   │   └── BulkImport.tsx (CSV/Excel upload handler)
│   └── common/
│       ├── Header.tsx
│       ├── Loading.tsx
│       └── Toast.tsx
├── lib/
│   ├── supabase.ts (Supabase client)
│   └── utils.ts (Utilities: calculations, formatting)
├── types/
│   └── index.ts (TypeScript interfaces)
├── .env.local
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🔑 Key Component Implementations

### 🆕 CSV/Excel Bulk Import Feature

**Supported Formats:**
- `.csv` – Comma-separated values
- `.xlsx` – Microsoft Excel 2007+
- `.xls` – Microsoft Excel 97-2003 (legacy)

**Expected File Structure:**

**Format A: With Weekly Breakdown**
```
Discord Username,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
dee-fairy,0,0,0,0,0,10,10
madeinchina6928,0,0,0,0,0,30,30
phantomaudlowave,5,0,0,0,0,30,30
```

**Format B: With Total Points (Alternative)**
```
Discord Username,Total Points
dee-fairy,20
madeinchina6928,60
phantomaudlowave,65
```

**Import Flow:**
1. Admin goes to Event Detail page
2. Clicks "Import Users & Points"
3. Selects CSV/Excel file
4. System parses and validates data
5. Displays preview (usernames + calculated totals)
6. Admin confirms import
7. App creates users + point entries automatically
8. Shows success/error report

**Import Validation:**
- ✅ File size < 5MB
- ✅ Valid file type (.csv, .xlsx, .xls)
- ✅ Required columns present
- ✅ No duplicate usernames in import
- ✅ All point values are numbers
- ✅ Handles missing/empty cells (treats as 0)

**Implementation:**
```typescript
// POST /api/users/bulk-import
{
  "event_id": "uuid-here",
  "file": FormData (multipart)
}

// Response
{
  "success": true,
  "imported": 12,
  "created_users": 5,
  "updated_users": 7,
  "failed": 0,
  "errors": [],
  "week_date": "2026-09-15"
}
```

### Points Management Flow
```
1. Admin selects Event
2. Load all users + weekly points for that event
3. Admin clicks "Edit" on a user's row
4. Modal opens with Mon-Sun input fields
5. Admin changes values
6. On save → UPDATE points table
7. Auto-calculate total_points
8. Refresh table with new values
```

### Leaderboard Generation
```
1. Query points WHERE event_id = {eventId}
2. Group by discord_id
3. SUM all daily points → total_points
4. COUNT non-zero days → participation
5. Sort by total_points DESC
6. Add rank badges (🥇 🥈 🥉)
7. Display in table + chart
```

---

## 🌐 Deployment to Vercel

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/discord-points-manager.git
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repo
4. Add Environment Variables (from `.env.local`)
5. Deploy!

### Step 3: Verify Environment Variables
- Vercel Dashboard → Settings → Environment Variables
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

---

## 📊 Usage Guide

### Admin Dashboard
1. **View Events** – All created events grouped by month
2. **Create Event** – Form to add new event
3. **Select Event** – View all users + weekly points
4. **Import Bulk Data** – Upload CSV/Excel with users + points
5. **Edit Points** – Click row → modal editor
6. **View Leaderboard** – Ranked list with badges
7. **Export CSV** – Download week's data

### Bulk Import Workflow
1. Click "Import Users & Points" button on event page
2. Select CSV or Excel file from computer
3. System validates and displays preview
4. Confirm to import all users and points
5. See import report (created, updated, errors)
6. Points automatically appear in table

### CSV Import Format (Option A - Weekly Breakdown)
```csv
Discord Username,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
dee-fairy,0,0,0,0,0,10,10
madeinchina6928,0,0,0,0,0,30,30
phantomaudlowave,5,0,0,0,0,30,30
imberribored,0,0,0,0,0,30,0
Danny,0,0,0,0,0,30,0
```

### CSV Import Format (Option B - Total Points)
```csv
Discord Username,Total Points
dee-fairy,20
madeinchina6928,60
phantomaudlowave,65
imberribored,30
Danny,30
```

### CSV Export Format (Download)
```csv
Discord Username,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,Total Points,Participation
dee-fairy,0,0,0,0,0,10,10,20,2
madeinchina6928,0,0,0,0,0,30,30,60,2
...
```

---

## 🔒 Security Considerations

✅ **Implemented:**
- File upload validation (size, type, format)
- CSV/Excel data validation before insertion
- Safe file parsing with validation

⚠️ **Best Practices:**
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for public queries
- Validate all uploaded file contents (no malicious scripts)
- Implement rate limiting for bulk import (e.g., 10 imports/hour)
- Monitor Supabase audit logs for suspicious bulk operations
- Sanitize CSV data before database insertion
- Set max file size to 5MB to prevent DoS attacks
- Keep Supabase credentials secure in environment variables

**File Upload Security:**
```typescript
// Validate file before processing
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

if (file.size > MAX_FILE_SIZE) {
  throw new Error('File too large');
}

if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Invalid file type');
}
```

---

## 🛠️ Development Tips

### Adding New Events
```typescript
// POST /api/events
const response = await fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event_name: 'Gaming Night', month: '2026-09' })
});
```

### Updating Points
```typescript
// PUT /api/points/[pointId]
const response = await fetch(`/api/points/${pointId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    monday: 10, tuesday: 15, wednesday: 20, 
    thursday: 0, friday: 25, saturday: 30, sunday: 10
  })
});
```

### Computing Rankings
```typescript
const leaderboard = points
  .reduce((acc, p) => {
    const existing = acc.find(u => u.discord_id === p.discord_id);
    if (existing) {
      existing.total_points += p.total_points;
    } else {
      acc.push({ discord_id: p.discord_id, total_points: p.total_points });
    }
    return acc;
  }, [])
  .sort((a, b) => b.total_points - a.total_points)
  .map((user, idx) => ({ ...user, rank: idx + 1 }));
```

### Bulk Import Implementation
```typescript
// Frontend: BulkImport.tsx
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

async function handleFileUpload(file: File, eventId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('event_id', eventId);

  const response = await fetch('/api/users/bulk-import', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  return result; // { success, imported, created_users, etc. }
}

// Backend: /api/users/bulk-import/route.ts
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  // 1. Parse file
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const eventId = formData.get('event_id') as string;

  let data: any[] = [];
  
  if (file.name.endsWith('.csv')) {
    const text = await file.text();
    data = Papa.parse(text, { header: true }).data;
  } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    data = XLSX.utils.sheet_to_json(worksheet);
  }

  // 3. Validate and transform data
  const users: any[] = [];
  const points: any[] = [];
  const errors: string[] = [];

  data.forEach((row, idx) => {
    const username = row['Discord Username']?.trim();
    if (!username) {
      errors.push(`Row ${idx + 2}: Missing Discord Username`);
      return;
    }

    // Parse points (either weekly or total)
    let totalPoints = 0;
    const weeklyPoints = {
      monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
      friday: 0, saturday: 0, sunday: 0
    };

    const dayColumns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hasWeeklyData = dayColumns.some(day => row[day] !== undefined);

    if (hasWeeklyData) {
      dayColumns.forEach(day => {
        const value = parseInt(row[day] || 0);
        weeklyPoints[day.toLowerCase()] = value;
        totalPoints += value;
      });
    } else if (row['Total Points']) {
      totalPoints = parseInt(row['Total Points']) || 0;
    }

    users.push({ discord_username: username });
    points.push({ username, ...weeklyPoints, totalPoints });
  });

  // 4. Insert to Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let createdUsers = 0;
  let updatedUsers = 0;

  for (const user of users) {
    const { error } = await supabase
      .from('users')
      .upsert(user, { onConflict: 'discord_username' });
    
    if (error) errors.push(`User ${user.discord_username}: ${error.message}`);
    else createdUsers++;
  }

  // Insert point records
  for (const point of points) {
    const { error } = await supabase
      .from('points')
      .insert({
        event_id: eventId,
        discord_id: point.username,
        monday: point.monday,
        tuesday: point.tuesday,
        wednesday: point.wednesday,
        thursday: point.thursday,
        friday: point.friday,
        saturday: point.saturday,
        sunday: point.sunday,
        week_date: new Date().toISOString().split('T')[0]
      });

    if (error) errors.push(`Points ${point.username}: ${error.message}`);
    else updatedUsers++;
  }

  return Response.json({
    success: errors.length === 0,
    imported: users.length,
    created_users: createdUsers,
    updated_users: updatedUsers,
    failed: errors.length,
    errors
  });
}
```



---

## 📈 Future Enhancements

- [ ] Role-based permissions (event manager vs full admin)
- [ ] Bulk import scheduling (auto-sync from cloud storage)
- [ ] Point multipliers for special events
- [ ] Notifications/alerts for high performers
- [ ] Analytics dashboard (trends, patterns, growth charts)
- [ ] Audit log (track all point changes, who edited what when)
- [ ] Duplicate detection in bulk imports (warn before overwriting)
- [ ] Leaderboard badges and achievement system
- [ ] Advanced filtering (by week, by participant, by event type)
- [ ] API documentation for integration with external systems

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Supabase connection error | Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct |
| Bulk import fails | Check file format (CSV/XLSX), file size < 5MB, columns match format |
| Import shows "Discord Username" errors | Ensure column header is exactly "Discord Username" |
| Points not saving | Check Supabase connection and API response for errors |
| CSV export empty | Ensure points exist for selected event/week |
| Import duplicates users | System uses UPSERT; re-importing same username updates points |
| File upload rejected | Allowed types: .csv, .xlsx, .xls | Max size: 5MB |

---

## 📞 Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Vercel Deployment:** https://vercel.com/docs
- **TailwindCSS:** https://tailwindcss.com/docs
- **PapaParse (CSV):** https://www.papaparse.com/docs
- **SheetJS (Excel):** https://sheetjs.com/docs

---

## 📄 License

MIT License – Feel free to modify and deploy!

---

**Last Updated:** September 2026  
**Version:** 1.2.0 (Final)  
**Status:** Production Ready ✅

---

**v1.2.0 Final Release:**
- ✅ Removed all authentication code
- ✅ Removed all auth configuration options
- ✅ Simplified environment variables (Supabase only)
- ✅ Finalized CSV/Excel bulk import feature
- ✅ No external auth dependencies
- ✅ Direct dashboard access (no login required)
