import { escapeMarkdown } from "discord.js";
import type { BotEvent, EventType } from "../api/types.ts";

const NUMBER = new Intl.NumberFormat("en-US");

export function formatNumber(n: number): string {
  return NUMBER.format(n);
}

// "1 pt", "1,250 pts".
export function formatPoints(points: number): string {
  return `${NUMBER.format(points)} ${points === 1 ? "pt" : "pts"}`;
}

// "1 player", "47 players".
export function plural(count: number, noun: string): string {
  return `${NUMBER.format(count)} ${noun}${count === 1 ? "" : "s"}`;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// Players tied for a top-three rank share its medal.
export function medal(rank: number): string | null {
  return MEDALS[rank] ?? null;
}

// The start of a leaderboard line: a medal for the top three, then `#4`, `#5`…
export function rankBadge(rank: number): string {
  return medal(rank) ?? `\`#${rank}\``;
}

// Player and event names are typed in by staff or imported from spreadsheets.
// Escaping Markdown makes a name like "*kenn*" show as typed.
export function safe(text: string): string {
  return escapeMarkdown(text);
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

// Each event type's pass colour on the dashboard (light theme, globals.css),
// and the dashboard's accent orange for "All events".
const EVENT_COLORS: Record<EventType, number> = {
  game_night: 0xcde8c1,
  tournament: 0xc9dff3,
  challenge: 0xf9d9b3,
  giveaway: 0xf7d0dc,
  community: 0xddd3f2,
  other: 0xebe2c6,
};
const ALL_EVENTS_COLOR = 0xf5a54a;

export function eventColor(event: BotEvent | null): number {
  return event ? (EVENT_COLORS[event.event_type] ?? EVENT_COLORS.other) : ALL_EVENTS_COLOR;
}

export function scopeName(event: BotEvent | null): string {
  return event ? event.event_name : "All events";
}
