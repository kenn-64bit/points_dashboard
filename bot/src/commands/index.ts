import type { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder } from "discord.js";
import type { ApiClient } from "../api/client.ts";
import type { BotConfig } from "../config.ts";
import { leaderboard } from "./leaderboard.ts";
import { userStats } from "./userStats.ts";

export interface CommandContext {
  api: ApiClient;
  config: BotConfig;
}

export interface Command {
  data: SlashCommandOptionsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
  autocomplete(interaction: AutocompleteInteraction, context: CommandContext): Promise<void>;
}

// Every command by name: the interaction router looks them up here, and
// deploy-commands registers all of them.
export const commands: ReadonlyMap<string, Command> = new Map(
  [leaderboard, userStats].map((command) => [command.data.name, command])
);
