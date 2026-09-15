import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// discord_id has no relation to a real Discord snowflake — it's a slug derived
// from the username, since bulk import never supplies a real ID. This is the
// only place that derivation happens; everything else treats discord_id as opaque.

function slugify(username: string): string {
  const slug = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `user-${shortHash(username)}`;
}

function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

export interface ResolvedUser {
  discord_id: string;
  discord_username: string;
  created: boolean;
}

// Looks up a user by username, creating one (with a deterministic slug ID) if
// none exists. Re-resolving the same username always returns its existing
// discord_id — the slug is only ever used to seed a brand-new user.
export async function resolveDiscordId(
  supabase: SupabaseClient,
  rawUsername: string
): Promise<ResolvedUser> {
  const username = rawUsername.trim();

  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("discord_id, discord_username")
    .eq("discord_username", username)
    .maybeSingle();

  if (lookupError) throw new Error(`User lookup failed: ${lookupError.message}`);
  if (existing) {
    return { discord_id: existing.discord_id, discord_username: existing.discord_username, created: false };
  }

  const baseSlug = slugify(username);
  const { data: created, error: insertError } = await supabase
    .from("users")
    .upsert({ discord_id: baseSlug, discord_username: username }, { onConflict: "discord_username" })
    .select("discord_id, discord_username")
    .single();

  if (!insertError && created) {
    return { discord_id: created.discord_id, discord_username: created.discord_username, created: true };
  }

  // Rare: baseSlug collides with a different username's existing discord_id (PK conflict).
  if (insertError?.code === "23505") {
    // Appending shortHash(username) again would reproduce the identical slug
    // when baseSlug is itself `user-${shortHash(username)}` (a purely
    // non-ASCII username) — the retry would collide again and never resolve.
    // A random disambiguator guarantees the retry slug actually differs.
    const retrySlug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
    const { data: retryCreated, error: retryError } = await supabase
      .from("users")
      .upsert({ discord_id: retrySlug, discord_username: username }, { onConflict: "discord_username" })
      .select("discord_id, discord_username")
      .single();

    if (retryError || !retryCreated) {
      throw new Error(`User creation failed after slug retry: ${retryError?.message}`);
    }
    return { discord_id: retryCreated.discord_id, discord_username: retryCreated.discord_username, created: true };
  }

  throw new Error(`User creation failed: ${insertError?.message}`);
}

export interface BatchResolvedUsers {
  // username -> discord_id
  idsByUsername: Map<string, string>;
  createdCount: number;
  // usernames that couldn't be resolved even via the batch upsert (rare PK
  // collisions) — caller should fall back to resolveDiscordId for these.
  unresolved: string[];
}

// Resolves many usernames to discord_ids in a small, fixed number of round
// trips instead of one lookup + one upsert per username — used by bulk import,
// where a per-row loop would otherwise do up to 2 DB calls per CSV row and
// risk exceeding a serverless function's execution time limit on large files.
export async function resolveDiscordIdsBatch(
  supabase: SupabaseClient,
  rawUsernames: string[]
): Promise<BatchResolvedUsers> {
  const usernames = [...new Set(rawUsernames.map((u) => u.trim()))];
  const idsByUsername = new Map<string, string>();

  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("discord_id, discord_username")
    .in("discord_username", usernames);
  if (lookupError) throw new Error(`User lookup failed: ${lookupError.message}`);

  for (const user of existing ?? []) {
    idsByUsername.set(user.discord_username, user.discord_id);
  }

  const missing = usernames.filter((u) => !idsByUsername.has(u));
  if (missing.length === 0) {
    return { idsByUsername, createdCount: 0, unresolved: [] };
  }

  const toCreate = missing.map((username) => ({ discord_id: slugify(username), discord_username: username }));
  const { data: created, error: insertError } = await supabase
    .from("users")
    .upsert(toCreate, { onConflict: "discord_username" })
    .select("discord_id, discord_username");

  if (insertError) throw new Error(`Batch user creation failed: ${insertError.message}`);

  let createdCount = 0;
  for (const user of created ?? []) {
    idsByUsername.set(user.discord_username, user.discord_id);
    createdCount++;
  }

  const unresolved = missing.filter((u) => !idsByUsername.has(u));
  return { idsByUsername, createdCount, unresolved };
}
