// Settings come from environment variables: `.env` locally (loaded by the npm
// scripts), the host's own settings in production. Each entry point reads only
// what it needs, so registering commands doesn't need the dashboard settings.

// Same minimum the dashboard enforces for BOT_API_SECRET.
const MIN_SECRET_LENGTH = 32;
const DEFAULT_TIMEOUT_MS = 8000;

export interface BotConfig {
  discordToken: string;
  apiUrl: URL;
  apiSecret: string;
  timeZone: string; // decides which calendar day "today" is
  apiTimeoutMs: number;
}

export interface DeployConfig {
  discordToken: string;
  clientId: string;
  guildId: string | null; // null registers the commands globally
}

// A setting that's missing or malformed, worded for whoever runs the bot.
export class ConfigError extends Error {}

function optional(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) throw new ConfigError(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

// The dashboard's base URL, with a trailing slash so API paths resolve under
// it even when it's served from a sub-path.
function readApiUrl(): URL {
  const raw = required("DASHBOARD_API_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`DASHBOARD_API_URL "${raw}" isn't a URL. Use the dashboard's address, e.g. https://your-app.vercel.app`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConfigError("DASHBOARD_API_URL must start with https:// (or http:// for a local dashboard).");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

export function readBotConfig(): BotConfig {
  const apiSecret = required("BOT_API_SECRET");
  if (apiSecret.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(`BOT_API_SECRET must be at least ${MIN_SECRET_LENGTH} characters, the same value as the dashboard's.`);
  }

  const timeZone = optional("BOT_TIMEZONE") ?? "UTC";
  if (!isTimeZone(timeZone)) {
    throw new ConfigError(`BOT_TIMEZONE "${timeZone}" isn't a time zone. Use a name like UTC or Asia/Manila.`);
  }

  const apiTimeoutMs = Number(optional("API_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(apiTimeoutMs) || apiTimeoutMs < 1000 || apiTimeoutMs > 60_000) {
    throw new ConfigError("API_TIMEOUT_MS must be a whole number of milliseconds from 1000 to 60000.");
  }

  return { discordToken: required("DISCORD_TOKEN"), apiUrl: readApiUrl(), apiSecret, timeZone, apiTimeoutMs };
}

export function readDeployConfig(): DeployConfig {
  return {
    discordToken: required("DISCORD_TOKEN"),
    clientId: required("DISCORD_CLIENT_ID"),
    guildId: optional("DISCORD_GUILD_ID"),
  };
}
