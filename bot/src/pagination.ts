import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction } from "discord.js";
import type { ApiClient } from "./api/client.ts";
import type { BotLeaderboard, BotTimeframe } from "./api/types.ts";
import { describeError, logFailure } from "./errors.ts";
import { clampPage, errorEmbed, leaderboardEmbed, noticeEmbed, pageCount } from "./ui/embeds.ts";

// Leaderboard pages turn with stateless buttons. Each button's customId holds
// the whole request, so a click needs nothing stored and keeps working after
// the bot restarts:
//   lb:<slot>:<page>:<owner's user id>:<event id|all>:<timeframe>:<date|->
// The slot (f/p/n/l) keeps the four ids unique, as Discord requires, even when
// two buttons lead to the same page. The longest id is about 90 characters,
// under Discord's 100.

const PREFIX = "lb";
const TIMEFRAMES: readonly string[] = ["event", "week", "day"];
const EVENT_RE = /^(all|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PageRequest {
  ownerId: string; // only the user who ran /leaderboard turns its pages
  event: string; // the event the first page showed, so "latest" can't change between pages
  timeframe: BotTimeframe;
  date: string | null;
}

function encode(slot: string, page: number, request: PageRequest): string {
  return [PREFIX, slot, page, request.ownerId, request.event, request.timeframe, request.date ?? "-"].join(":");
}

function decode(customId: string): (PageRequest & { page: number }) | null {
  const [prefix, , page = "", ownerId = "", event = "", timeframe = "", date = "", ...extra] = customId.split(":");
  const valid =
    prefix === PREFIX &&
    extra.length === 0 &&
    /^\d+$/.test(page) &&
    /^\d+$/.test(ownerId) &&
    EVENT_RE.test(event) &&
    TIMEFRAMES.includes(timeframe) &&
    (date === "-" || DATE_RE.test(date));
  if (!valid) return null;
  return { page: Number(page), ownerId, event, timeframe: timeframe as BotTimeframe, date: date === "-" ? null : date };
}

export function isPageButton(customId: string): boolean {
  return customId.startsWith(`${PREFIX}:`);
}

// The standings a leaderboard showed, so every page asks for the same ones.
function requestFor(board: BotLeaderboard, ownerId: string): PageRequest {
  return {
    ownerId,
    event: board.event?.event_id ?? "all",
    timeframe: board.period.timeframe,
    date: board.period.date ?? board.period.week_date,
  };
}

function pageButtons(request: PageRequest, page: number, pages: number): ActionRowBuilder<ButtonBuilder>[] {
  if (pages <= 1) return [];
  const first = page === 0;
  const last = page === pages - 1;
  const button = (slot: string, emoji: string, target: number, disabled: boolean) =>
    new ButtonBuilder()
      .setCustomId(encode(slot, target, request))
      .setEmoji(emoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);
  const position = new ButtonBuilder()
    .setCustomId(`${PREFIX}:position`)
    .setLabel(`${page + 1} / ${pages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      button("f", "⏮️", 0, first),
      button("p", "◀️", Math.max(page - 1, 0), first),
      position,
      button("n", "▶️", Math.min(page + 1, pages - 1), last),
      button("l", "⏭️", pages - 1, last)
    ),
  ];
}

// One page of a leaderboard reply: the embed and, when there's more than one
// page, the buttons to move between them.
export function leaderboardMessage(board: BotLeaderboard, requestedPage: number, ownerId: string) {
  const page = clampPage(board, requestedPage);
  return {
    embeds: [leaderboardEmbed(board, page)],
    components: pageButtons(requestFor(board, ownerId), page, pageCount(board)),
  };
}

export async function handlePageButton(interaction: ButtonInteraction, api: ApiClient): Promise<void> {
  const request = decode(interaction.customId);
  if (!request) {
    await interaction.reply({
      embeds: [errorEmbed("These buttons don't work anymore. Run /leaderboard again.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (interaction.user.id !== request.ownerId) {
    await interaction.reply({
      embeds: [noticeEmbed(`Only <@${request.ownerId}> can turn these pages. Run /leaderboard to get your own.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  try {
    const board = await api.leaderboard({
      event: request.event,
      timeframe: request.timeframe,
      date: request.date ?? undefined,
    });
    await interaction.editReply(leaderboardMessage(board, request.page, request.ownerId));
  } catch (err) {
    logFailure("leaderboard page", err);
    await interaction.followUp({ embeds: [errorEmbed(describeError(err))], flags: MessageFlags.Ephemeral });
  }
}
