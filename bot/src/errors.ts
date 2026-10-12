import { MessageFlags, escapeMarkdown, type ChatInputCommandInteraction, type InteractionReplyOptions } from "discord.js";
import { ApiError } from "./api/client.ts";
import { errorEmbed } from "./ui/embeds.ts";

// A problem with what the user asked for (a bad date, an unknown event name),
// already worded for them.
export class UserFacingError extends Error {}

// The dashboard's own messages ("Event not found") as a sentence.
function asSentence(text: string): string {
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

// What to tell the user. Details such as status codes and stack traces only
// go to the log, never into Discord.
export function describeError(err: unknown): string {
  if (err instanceof UserFacingError) return err.message;
  if (!(err instanceof ApiError)) return "Something went wrong on my end. Please try again.";
  switch (err.kind) {
    case "timeout":
      return "The points dashboard is taking too long to answer. Please try again in a moment.";
    case "network":
      return "I can't reach the points dashboard right now. Please try again later.";
    case "unauthorized":
    case "unavailable":
      return "I'm not set up to read the points dashboard. Please let an admin know.";
    case "rate_limited":
      return `The points dashboard is busy. Please try again in ${err.retryAfterSeconds ?? 30} seconds.`;
    case "not_found":
    case "bad_request":
      // The dashboard's wording, which can quote what the user typed.
      return escapeMarkdown(asSentence(err.message));
    case "server":
      return "The points dashboard ran into a problem. Please try again later.";
  }
}

// Logs a failure at a level that matches it: an unknown player is routine,
// a secret that doesn't match is something to fix.
export function logFailure(context: string, err: unknown): void {
  if (err instanceof UserFacingError) return;
  if (!(err instanceof ApiError)) {
    console.error(`[${context}]`, err);
    return;
  }
  const line = `[${context}] ${err.kind}${err.status ? ` (HTTP ${err.status})` : ""}: ${err.message}`;
  if (err.kind === "not_found" || err.kind === "bad_request") console.info(line);
  else if (err.kind === "unauthorized" || err.kind === "unavailable") {
    console.error(`${line}. Check that BOT_API_SECRET is set on the dashboard and matches the bot's.`);
  } else console.warn(line);
}

// Reports a failed slash command. A deferred reply is public, so it's swapped
// for a private follow-up: error messages stay out of the channel.
export async function replyError(interaction: ChatInputCommandInteraction, err: unknown): Promise<void> {
  logFailure(`/${interaction.commandName}`, err);
  const reply: InteractionReplyOptions = { embeds: [errorEmbed(describeError(err))], flags: MessageFlags.Ephemeral };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.deleteReply().catch(() => {});
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  } catch (replyErr) {
    console.warn(`[/${interaction.commandName}] Couldn't send the error message:`, replyErr);
  }
}
