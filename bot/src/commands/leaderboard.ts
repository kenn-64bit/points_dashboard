import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { leaderboardMessage } from "../pagination.ts";
import type { Command } from "./index.ts";
import { dateOption, eventChoices, eventOption, readStandingsInput, resolveEvent, timeframeOption } from "./shared.ts";

// /leaderboard [event] [timeframe] [date]: the standings, 10 players a page.
export const leaderboard: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Points standings for an event, a week or a day")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(eventOption)
    .addStringOption(timeframeOption)
    .addStringOption(dateOption),

  async execute(interaction, { api, config }) {
    const input = readStandingsInput(interaction, config.timeZone);
    // Discord allows 3 seconds before the first reply; the request may take longer.
    await interaction.deferReply();
    const event = await resolveEvent(api, input.event);
    const board = await api.leaderboard({ event, timeframe: input.timeframe, date: input.date });
    await interaction.editReply(leaderboardMessage(board, 0, interaction.user.id));
  },

  async autocomplete(interaction, { api }) {
    const focused = interaction.options.getFocused(true);
    await interaction.respond(focused.name === "event" ? await eventChoices(api, focused.value) : []);
  },
};
