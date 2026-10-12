import { Client, Events, GatewayIntentBits } from "discord.js";
import { createApiClient } from "./api/client.ts";
import { commands, type CommandContext } from "./commands/index.ts";
import { ConfigError, readBotConfig, type BotConfig } from "./config.ts";
import { logFailure, replyError } from "./errors.ts";
import { handlePageButton, isPageButton } from "./pagination.ts";

function loadConfig(): BotConfig {
  try {
    return readBotConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[bot] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

const config = loadConfig();
const api = createApiClient({ baseUrl: config.apiUrl, secret: config.apiSecret, timeoutMs: config.apiTimeoutMs });
const context: CommandContext = { api, config };

const client = new Client({
  // Slash commands and buttons need only the Guilds intent, no privileged ones.
  intents: [GatewayIntentBits.Guilds],
  // Names come from spreadsheets: never let one ping @everyone or a role.
  allowedMentions: { parse: [] },
});

client.once(Events.ClientReady, async (ready) => {
  console.info(`[bot] Logged in as ${ready.user.tag}, in ${ready.guilds.cache.size} server(s)`);
  // Checks the dashboard settings up front and fills the autocomplete caches.
  try {
    const [events, players] = await Promise.all([api.events(), api.players()]);
    console.info(`[bot] Dashboard API OK at ${config.apiUrl.origin}: ${events.length} events, ${players.length} players`);
  } catch (err) {
    logFailure("startup check", err);
    console.warn("[bot] Commands will answer with an error until the dashboard API responds.");
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, context);
    } catch (err) {
      await replyError(interaction, err);
    }
  } else if (interaction.isAutocomplete()) {
    try {
      await commands.get(interaction.commandName)?.autocomplete(interaction, context);
    } catch (err) {
      logFailure(`/${interaction.commandName} autocomplete`, err);
      // An empty list beats Discord's "Loading options failed".
      if (!interaction.responded) await interaction.respond([]).catch(() => {});
    }
  } else if (interaction.isButton() && isPageButton(interaction.customId)) {
    try {
      await handlePageButton(interaction, api);
    } catch (err) {
      logFailure("leaderboard page", err);
    }
  }
});

client.on(Events.Error, (err) => console.error("[discord]", err));
client.on(Events.Warn, (message) => console.warn("[discord]", message));
process.on("unhandledRejection", (reason) => console.error("[bot] Unhandled rejection:", reason));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    console.info(`[bot] ${signal} received, logging out`);
    void client.destroy().finally(() => process.exit(0));
  });
}

try {
  await client.login(config.discordToken);
} catch (err) {
  console.error("[bot] Couldn't log in to Discord. Check DISCORD_TOKEN.", err);
  process.exit(1);
}
