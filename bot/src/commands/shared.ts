import {
  GuildMember,
  escapeMarkdown,
  type ApplicationCommandOptionChoiceData,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption,
} from "discord.js";
import { ApiError, type ApiClient } from "../api/client.ts";
import type { BotPlayer, BotTimeframe } from "../api/types.ts";
import { UserFacingError } from "../errors.ts";
import { formatMonth, parseDateInput } from "../ui/dates.ts";
import { truncate } from "../ui/format.ts";

// The options /leaderboard and /user-stats share, and the lookups behind them.

export const ALL_EVENTS = "all";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Discord's limits for autocomplete: 25 choices of up to 100 characters,
// answered within 3 seconds.
const MAX_CHOICES = 25;
const MAX_CHOICE_LENGTH = 100;
const AUTOCOMPLETE_DEADLINE_MS = 2500;

type Choice = ApplicationCommandOptionChoiceData<string>;

// ─── Options ─────────────────────────────────────────────────────────────────

export function eventOption(option: SlashCommandStringOption) {
  return option.setName("event").setDescription("Which event (default: the latest one)").setAutocomplete(true);
}

export function timeframeOption(option: SlashCommandStringOption) {
  return option
    .setName("timeframe")
    .setDescription("Whole event, one week or one day (default: whole event)")
    .addChoices(
      { name: "Per event (all weeks)", value: "event" },
      { name: "Per week", value: "week" },
      { name: "Per day", value: "day" }
    );
}

export function dateOption(option: SlashCommandStringOption) {
  return option
    .setName("date")
    .setDescription("For a week or day: YYYY-MM-DD, today or yesterday (default: today)")
    .setMaxLength(10);
}

export interface StandingsInput {
  event: string | null; // as picked or typed; resolveEvent turns it into what the API takes
  timeframe: BotTimeframe;
  date: string | undefined; // YYYY-MM-DD, for the week and day timeframes
}

// The shared options, checked before anything is fetched, so a mistake here
// is answered privately and at once, before the reply is deferred.
export function readStandingsInput(interaction: ChatInputCommandInteraction, timeZone: string): StandingsInput {
  const event = interaction.options.getString("event")?.trim() || null;
  const timeframe = (interaction.options.getString("timeframe") ?? "event") as BotTimeframe;
  const rawDate = interaction.options.getString("date")?.trim() || null;

  if (timeframe === "event") {
    if (rawDate) throw new UserFacingError("`date` only works with the **Per week** or **Per day** timeframe.");
    return { event, timeframe, date: undefined };
  }
  const date = parseDateInput(rawDate ?? "today", timeZone);
  if (!date) {
    throw new UserFacingError(
      `"${escapeMarkdown(rawDate ?? "")}" isn't a date I understand. Use YYYY-MM-DD (like 2026-09-22), today or yesterday.`
    );
  }
  return { event, timeframe, date };
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

// The `event` option as the API takes it: an event id, "all", or undefined
// for the latest event. Picking from the list sends an id; typed text is
// matched against event names, newest event first.
export async function resolveEvent(api: ApiClient, input: string | null): Promise<string | undefined> {
  if (!input) return undefined;
  if (input === ALL_EVENTS || UUID_RE.test(input)) return input;
  const wanted = input.toLowerCase();
  if (wanted === "all events") return ALL_EVENTS;

  const match = (await api.events()).find((event) => event.event_name.toLowerCase() === wanted);
  if (!match) throw new UserFacingError(`There's no event called "${escapeMarkdown(input)}". Pick one from the list.`);
  return match.event_id;
}

// The exact name first, then one that matches ignoring case.
export function findPlayer(players: BotPlayer[], name: string): BotPlayer | undefined {
  const lower = name.toLowerCase();
  return (
    players.find((player) => player.discord_username === name) ??
    players.find((player) => player.discord_username.toLowerCase() === lower)
  );
}

// Up to three known names that contain the unknown one, or that it contains,
// for "Did you mean …?".
export function similarNames(players: BotPlayer[], name: string): string[] {
  const lower = name.toLowerCase();
  return players
    .map((player) => player.discord_username)
    .filter((candidate) => {
      const other = candidate.toLowerCase();
      return other.includes(lower) || (other.length >= 3 && lower.includes(other));
    })
    .slice(0, 3);
}

// /user-stats without a player means the caller. Player ids on the dashboard
// aren't Discord user ids, so the caller's names (username, then display
// name, then server nickname) are matched against the stored names.
export async function resolveSelf(api: ApiClient, interaction: ChatInputCommandInteraction): Promise<string> {
  const { user, member } = interaction;
  const nickname = member instanceof GuildMember ? member.nickname : (member?.nick ?? null);
  const names = [...new Set([user.username, user.globalName, nickname].filter((name): name is string => !!name))];

  const players = await api.players();
  for (const name of names) {
    const match = findPlayer(players, name);
    if (match) return match.discord_username;
  }
  const tried = names.map((name) => `**${escapeMarkdown(name)}**`).join(" or ");
  throw new UserFacingError(
    `I couldn't find you on the dashboard as ${tried}. Use the \`player\` option to look someone up.`
  );
}

// ─── Autocomplete ────────────────────────────────────────────────────────────

// Gives up on a slow first load, so the answer still reaches Discord in time.
// The load carries on and fills the cache for the next keystroke.
function withDeadline<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new ApiError("timeout", "Autocomplete stopped waiting for the dashboard")),
        AUTOCOMPLETE_DEADLINE_MS
      ).unref();
    }),
  ]);
}

// "All events" first, then events whose name contains what's typed, newest first.
export async function eventChoices(api: ApiClient, typed: string): Promise<Choice[]> {
  const query = typed.trim().toLowerCase();
  const events = await withDeadline(api.events());
  const choices: Choice[] = events
    .filter((event) => event.event_name.toLowerCase().includes(query))
    .map((event) => ({
      name: truncate(`${event.event_name} · ${event.event_type_label} · ${formatMonth(event.month)}`, MAX_CHOICE_LENGTH),
      value: event.event_id,
    }));
  if ("all events".includes(query)) choices.unshift({ name: "🌐 All events", value: ALL_EVENTS });
  return choices.slice(0, MAX_CHOICES);
}

// Names that contain what's typed, A→Z, with those that start with it first.
export async function playerChoices(api: ApiClient, typed: string): Promise<Choice[]> {
  const query = typed.trim().toLowerCase();
  const players = await withDeadline(api.players());
  const startsWith = (player: BotPlayer) => player.discord_username.toLowerCase().startsWith(query);
  return players
    .filter((player) => player.discord_username.toLowerCase().includes(query))
    .sort((a, b) => Number(startsWith(b)) - Number(startsWith(a)))
    .slice(0, MAX_CHOICES)
    .map((player) => ({ name: player.discord_username, value: player.discord_username }));
}
