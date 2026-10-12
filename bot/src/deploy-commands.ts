import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.ts";
import { ConfigError, readDeployConfig } from "./config.ts";

// Registers the slash commands with Discord. Run it once after setup, and
// again whenever a command or its options change; not on every start.
//   npm run deploy-commands              to the server in DISCORD_GUILD_ID, or globally
//   npm run deploy-commands -- --dry-run print the commands, register nothing

const body = [...commands.values()].map((command) => command.data.toJSON());

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify(body, null, 2));
} else {
  try {
    const { discordToken, clientId, guildId } = readDeployConfig();
    const rest = new REST().setToken(discordToken);
    const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
    const registered = (await rest.put(route, { body })) as unknown[];
    console.log(`Registered ${registered.length} commands ${guildId ? `in server ${guildId}` : "globally"}.`);
  } catch (err) {
    console.error(err instanceof ConfigError ? err.message : err);
    process.exitCode = 1;
  }
}
