import { EmbedBuilder } from "discord.js";
import type { BotEvent, BotLeaderboard, BotUserStats } from "../api/types.ts";
import { eventColor, formatNumber, formatPoints, medal, plural, rankBadge, safe, scopeName, truncate } from "./format.ts";

export const PAGE_SIZE = 10;

// Discord's embed limits.
const TITLE_MAX = 256;
const FIELD_VALUE_MAX = 1024;

const ERROR_COLOR = 0xd9534f;
const NOTICE_COLOR = 0x8b95a5;

export function pageCount(board: BotLeaderboard): number {
  return Math.max(1, Math.ceil(board.rows.length / PAGE_SIZE));
}

// A page that exists, e.g. after the standings shrank since a button was made.
export function clampPage(board: BotLeaderboard, page: number): number {
  return Math.min(Math.max(page, 0), pageCount(board) - 1);
}

// Footer parts joined with " · ", plus the event's type. Discord rejects an
// empty footer, so callers skip it when this is empty.
function footerText(event: BotEvent | null, parts: string[]): string {
  return [...parts, event?.event_type_label].filter(Boolean).join(" · ");
}

function withFooter(embed: EmbedBuilder, text: string): EmbedBuilder {
  return text ? embed.setFooter({ text }) : embed;
}

// One page of standings; `page` counts from 0.
export function leaderboardEmbed(board: BotLeaderboard, requestedPage: number): EmbedBuilder {
  const page = clampPage(board, requestedPage);
  const embed = new EmbedBuilder()
    .setColor(eventColor(board.event))
    .setTitle(truncate(`🏆 ${scopeName(board.event)} — Leaderboard`, TITLE_MAX))
    .setTimestamp(new Date(board.generated_at));

  if (board.rows.length === 0) {
    const who =
      board.participants > 0 ? `${plural(board.participants, "player")} entered, but nobody has` : "Nobody has";
    embed.setDescription(
      `**${board.period.label}**\n\n${who} scored in this period yet.\n*Try another \`timeframe\` or \`date\`.*`
    );
    return withFooter(embed, footerText(board.event, []));
  }

  const lines = board.rows
    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map((row) => `${rankBadge(row.rank)} **${safe(row.discord_username)}** — ${formatPoints(row.total_points)}`);
  embed.setDescription(`**${board.period.label}**\n\n${lines.join("\n")}`);
  return withFooter(
    embed,
    footerText(board.event, [`Page ${page + 1}/${pageCount(board)}`, `${plural(board.rows.length, "player")} scored`])
  );
}

// As many whole lines as fit in `max` characters, ending "…and N more" when
// some had to go.
function fitLines(lines: string[], max: number): string {
  for (let count = lines.length; count > 0; count--) {
    const hidden = lines.length - count;
    const text = lines.slice(0, count).join("\n") + (hidden > 0 ? `\n…and ${hidden} more` : "");
    if (text.length <= max) return text;
  }
  return `…and ${lines.length} more`;
}

function breakdownField({ period, event, breakdown }: BotUserStats): { name: string; value: string } | null {
  if (breakdown.length === 0) return null;
  if (period.timeframe === "week") {
    // Seven short entries fit on one line: "Mon **10** · Tue **0** · …"
    return {
      name: "By day",
      value: breakdown.map((item) => `${item.label} **${formatNumber(item.points)}**`).join(" · "),
    };
  }
  const lines = breakdown.map((item) => `${safe(item.label)} — **${formatPoints(item.points)}**`);
  return { name: event ? "By week" : "By event", value: fitLines(lines, FIELD_VALUE_MAX) };
}

export function userStatsEmbed(stats: BotUserStats): EmbedBuilder {
  const { rank } = stats;
  const rankText = rank === null ? "—" : `${medal(rank) ?? ""} #${rank} of ${formatNumber(stats.ranked_players)}`.trim();
  const label = `**${stats.period.label}**`;

  const embed = new EmbedBuilder()
    .setColor(eventColor(stats.event))
    .setTitle(truncate(`📊 ${stats.player.discord_username} — ${scopeName(stats.event)}`, TITLE_MAX))
    .setDescription(stats.points > 0 ? label : `${label}\n\nNo points in this period yet.`)
    .addFields(
      { name: "Points", value: formatPoints(stats.points), inline: true },
      { name: "Rank", value: rankText, inline: true },
      { name: "Active days", value: formatNumber(stats.active_days), inline: true }
    )
    .setTimestamp(new Date(stats.generated_at));

  const breakdown = breakdownField(stats);
  if (breakdown) embed.addFields(breakdown);
  return withFooter(embed, footerText(stats.event, []));
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(ERROR_COLOR).setDescription(`⚠️ ${message}`);
}

export function noticeEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(NOTICE_COLOR).setDescription(message);
}
