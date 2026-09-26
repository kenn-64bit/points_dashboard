import "server-only";
import { DAY_COLUMNS } from "@/types";

// In-memory stand-in for the Supabase client, used only when
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't set (see
// lib/supabase.ts). Lets the whole app — including editing points and bulk
// import — be checked with zero backend setup. Data is hardcoded below and
// resets whenever the dev server restarts; it is never used once real
// Supabase credentials are configured.

interface MockEvent {
  event_id: string;
  event_name: string;
  event_type: string;
  description: string | null;
  created_at: string;
  month: string;
}
interface MockUser {
  discord_id: string;
  discord_username: string;
  created_at: string;
}
interface MockPoints {
  point_id: string;
  event_id: string;
  discord_id: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  total_points: number;
  week_date: string;
  created_at: string;
  updated_at: string;
}

interface MockAppUser {
  email: string;
  password_hash: string;
  role: "admin" | "member";
  created_at: string;
}

interface MockStore {
  events: MockEvent[];
  users: MockUser[];
  points: MockPoints[];
  app_users: MockAppUser[];
}

// Dev-only sign-in for mock mode: admin@example.com / admin. The hash was
// generated with scripts/hash-password.mjs; this account never exists once
// real Supabase credentials are configured.
export const MOCK_ADMIN_EMAIL = "admin@example.com";
export const MOCK_ADMIN_PASSWORD = "admin";
function seedAppUsers(): MockAppUser[] {
  return [
    {
      email: MOCK_ADMIN_EMAIL,
      password_hash:
        "scrypt$wHvq0XtWEWY0q9ULieqsyw==$+2UK8wCD6fVFvYJtDYZo39Xc+Rrr/aCirUgZ/n9S5hEqrxDX7Y6qEOjHscH3K7siXpql0gge7Qb8/UbWEGNstg==",
      role: "admin",
      created_at: new Date().toISOString(),
    },
  ];
}

function buildSeedStore(): MockStore {
  return { events: [], users: [], points: [], app_users: seedAppUsers() };
}

// Persist across Next.js dev hot-reloads (module cache is otherwise reset per
// recompiled route, which would silently wipe edits during a session).
const globalForMock = globalThis as unknown as { __dpmMockStore?: MockStore };
const store = globalForMock.__dpmMockStore ?? buildSeedStore();
// A store kept from before app_users existed won't have the key.
store.app_users ??= seedAppUsers();
globalForMock.__dpmMockStore = store;

type Row = Record<string, unknown>;
type Filter = [string, unknown];
type Op =
  | { kind: "select" }
  | { kind: "insert"; payload: Row | Row[] }
  | { kind: "update"; payload: Row }
  | { kind: "upsert"; payload: Row | Row[]; onConflict?: string; ignoreDuplicates?: boolean }
  | { kind: "delete" };

class MockQueryBuilder<T extends Row> implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private filters: Filter[] = [];
  private inFilters: [string, unknown[]][] = [];
  private orderSpec: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private selectSpec: string | null = null;
  private op: Op = { kind: "select" };
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(private table: keyof MockStore) {}

  select(cols?: string) {
    this.selectSpec = cols ?? "*";
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push([col, value]);
    return this;
  }
  in(col: string, values: unknown[]) {
    this.inFilters.push([col, values]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderSpec = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = { kind: "insert", payload };
    return this;
  }
  update(payload: Row) {
    this.op = { kind: "update", payload };
    return this;
  }
  upsert(payload: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = { kind: "upsert", payload, onConflict: opts?.onConflict, ignoreDuplicates: opts?.ignoreDuplicates };
    return this;
  }
  delete() {
    this.op = { kind: "delete" };
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }

  then<TResult1, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private rows(): T[] {
    return store[this.table] as unknown as T[];
  }

  private matches(row: T): boolean {
    return (
      this.filters.every(([col, value]) => (row as Row)[col] === value) &&
      this.inFilters.every(([col, values]) => values.includes((row as Row)[col]))
    );
  }

  private project(row: T): Row {
    const base: Row = { ...row };
    if (this.table === "points" && this.selectSpec?.includes("users(")) {
      const user = store.users.find((u) => u.discord_id === (row as unknown as MockPoints).discord_id) ?? null;
      base.users = user ? { discord_id: user.discord_id, discord_username: user.discord_username } : null;
    }
    if (this.table === "points" && this.selectSpec === "users(*)") {
      const user = store.users.find((u) => u.discord_id === (row as unknown as MockPoints).discord_id) ?? null;
      return { users: user };
    }
    return base;
  }

  private recompute(row: Row) {
    if (this.table === "points") {
      const total_points = DAY_COLUMNS.reduce((sum, day) => sum + (Number(row[day]) || 0), 0);
      row.total_points = total_points;
      row.updated_at = new Date().toISOString();
    }
  }

  private buildNewRow(payload: Row): Row {
    const now = new Date().toISOString();
    if (this.table === "events") {
      const created_at = now;
      return {
        event_id: (payload.event_id as string) ?? crypto.randomUUID(),
        event_name: payload.event_name,
        event_type: payload.event_type ?? "other",
        description: payload.description ?? null,
        created_at,
        month: created_at.slice(0, 7),
      };
    }
    if (this.table === "users") {
      return {
        discord_id: payload.discord_id,
        discord_username: payload.discord_username,
        created_at: now,
      };
    }
    // points
    const days = Object.fromEntries(DAY_COLUMNS.map((day) => [day, Number(payload[day]) || 0]));
    const total_points = Object.values(days).reduce((sum: number, v) => sum + (v as number), 0);
    return {
      point_id: (payload.point_id as string) ?? crypto.randomUUID(),
      event_id: payload.event_id,
      discord_id: payload.discord_id,
      ...days,
      total_points,
      week_date: payload.week_date,
      created_at: now,
      updated_at: now,
    };
  }

  private wrapResult(resultRows: Row[]) {
    const projected = resultRows.map((r) => this.project(r as T));
    if (this.singleMode === "single") {
      return { data: projected[0] ?? null, error: projected.length ? null : { message: "No rows found" } };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: projected[0] ?? null, error: null };
    }
    return { data: projected, error: null };
  }

  private async execute(): Promise<{ data: unknown; error: { message: string } | null }> {
    try {
      const rows = this.rows();

      if (this.op.kind === "delete") {
        const removed = rows.filter((r) => this.matches(r));
        const remaining = rows.filter((r) => !this.matches(r));
        const bucket = store[this.table] as unknown as T[];
        bucket.length = 0;
        bucket.push(...remaining);
        return this.wrapResult(removed);
      }

      if (this.op.kind === "insert") {
        const payloads = Array.isArray(this.op.payload) ? this.op.payload : [this.op.payload];
        const created = payloads.map((p) => this.buildNewRow(p));
        rows.push(...(created as T[]));
        return this.wrapResult(created);
      }

      if (this.op.kind === "update") {
        const { payload } = this.op;
        const targets = rows.filter((r) => this.matches(r));
        targets.forEach((r) => {
          Object.assign(r as Row, payload);
          this.recompute(r as Row);
        });
        return this.wrapResult(targets);
      }

      if (this.op.kind === "upsert") {
        const { payload, onConflict, ignoreDuplicates } = this.op;
        const payloads = Array.isArray(payload) ? payload : [payload];
        const keyCols = (onConflict ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        const results: Row[] = [];
        for (const p of payloads) {
          const match = rows.find((r) => keyCols.length > 0 && keyCols.every((c) => (r as Row)[c] === p[c]));
          if (match) {
            // Mirrors Supabase's ON CONFLICT DO NOTHING: the existing row is left
            // untouched and omitted from the returned rows.
            if (ignoreDuplicates) continue;
            Object.assign(match as Row, p);
            this.recompute(match as Row);
            results.push(match as Row);
          } else {
            const created = this.buildNewRow(p);
            rows.push(created as T);
            results.push(created);
          }
        }
        return this.wrapResult(results);
      }

      // plain select
      let result = rows.filter((r) => this.matches(r));
      if (this.orderSpec) {
        const { col, ascending } = this.orderSpec;
        result = [...result].sort((a, b) => {
          const av = (a as Row)[col];
          const bv = (b as Row)[col];
          const cmp = av === bv ? 0 : av! < bv! ? -1 : 1;
          return ascending ? cmp : -cmp;
        });
      }
      if (this.limitN != null) result = result.slice(0, this.limitN);
      return this.wrapResult(result);
    } catch (err) {
      return { data: null, error: { message: (err as Error).message } };
    }
  }
}

export function createMockSupabaseClient() {
  return {
    from(table: keyof MockStore) {
      return new MockQueryBuilder(table);
    },
  };
}
