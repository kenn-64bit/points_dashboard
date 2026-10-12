import { InteractionContextType, SlashCommandBuilder, escapeMarkdown } from "discord.js";
import { ApiError, type ApiClient } from "../api/client.ts";
import { UserFacingError } from "../errors.ts";
import { userStatsEmbed } from "../ui/embeds.ts";
import type { Command } from "./index.ts";
import {
  dateOption,
  eventChoices,
  eventOption,
  findPlayer,
  playerChoices,
  readStandingsInput,
  resolveEvent,
  resolveSelf,
  similarNames,
  timeframeOption,
} from "./shared.ts";

// A 404 from user-stats is about the player or the event. When the name isn't
// a known player, say so with close matches; otherwise keep the API's message.
async function explainNotFound(api: ApiClient, err: unknown, name: string): Promise<unknown> {
  if (!(err instanceof ApiError) || err.kind !== "not_found") return err;
  const players = await api.players().catch(() => null);
  if (!players || findPlayer(players, name)) return err;

  const suggestions = similarNames(players, name).map((suggestion) => `**${escapeMarkdown(suggestion)}**`);
  const hint = suggestions.length > 0 ? ` Did you mean ${suggestions.join(", ")}?` : "";
  return new UserFacingError(`There's no player called "${escapeMarkdown(name)}" on the dashboard.${hint}`);
}

// /user-stats [player] [event] [timeframe] [date]: one player's points, rank
// and where the points came from. Without a player, it's the caller.
export const userStats: Command = {
  data: new SlashCommandBuilder()
    .setName("user-stats")
    .setDescription("A player's points, rank and breakdown for an event, a week or a day")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option.setName("player").setDescription("Player name (default: you)").setAutocomplete(true).setMaxLength(32)
    )
    .addStringOption(eventOption)
    .addStringOption(timeframeOption)
    .addStringOption(dateOption),

  async execute(interaction, { api, config }) {
    const input = readStandingsInput(interaction, config.timeZone);
    const typedPlayer = interaction.options.getString("player")?.trim() || null;
    // Discord allows 3 seconds before the first reply; the requests may take longer.
    await interaction.deferReply();
    const [player, event] = await Promise.all([
      typedPlayer ?? resolveSelf(api, interaction),
      resolveEvent(api, input.event),
    ]);
    try {
      const stats = await api.userStats(player, { event, timeframe: input.timeframe, date: input.date });
      await interaction.editReply({ embeds: [userStatsEmbed(stats)] });
    } catch (err) {
      throw await explainNotFound(api, err, player);
    }
  },

  async autocomplete(interaction, { api }) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "player") await interaction.respond(await playerChoices(api, focused.value));
    else if (focused.name === "event") await interaction.respond(await eventChoices(api, focused.value));
    else await interaction.respond([]);
  },
};
