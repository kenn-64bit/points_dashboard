// The one text policy for every free-text field (event names, descriptions,
// usernames). Shared by the forms, which strip as you type, and the API,
// which re-checks and never trusts the client.
//
// Allowed: letters in any script, numbers, emoji and everyday punctuation.
// Removed: invisible characters that can spoof or break data, meaning control
// characters (a NUL byte makes Postgres reject the row), zero-width spaces,
// bidi overrides/isolates ("Trojan Source" style reordering) and BOMs. The
// ZWJ/ZWNJ joiners and variation selectors are kept so emoji sequences and
// scripts such as Persian still render.
// Blocked: code-like symbols < > { } ` \ — harmless under React's escaping,
// but kept out as defence in depth for anything that reads this data later.

const INVISIBLE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​‎‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const BLOCKED_CHARS = /[<>{}`\\]/g;

export const BLOCKED_CHARS_LABEL = "< > { } ` \\";

type TextOptions = { multiline?: boolean };

// While typing: drop what's never allowed, but don't trim, so a trailing
// space the user is about to follow with another word survives.
export function stripDisallowed(value: string, { multiline = false }: TextOptions = {}): string {
  const stripped = value.normalize("NFC").replace(INVISIBLE_CHARS, "").replace(BLOCKED_CHARS, "");
  return multiline ? stripped.replace(/\r\n?/g, "\n").replace(/\t/g, " ") : stripped.replace(/[\t\r\n]+/g, " ");
}

// Before saving: stripDisallowed, then tidy whitespace.
export function cleanText(value: string, options: TextOptions = {}): string {
  const stripped = stripDisallowed(value, options);
  if (!options.multiline) return stripped.replace(/ {2,}/g, " ").trim();
  return stripped
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Server-side: blocked symbols are an error rather than silently removed, so
// data that bypassed the form is rejected instead of quietly changed.
// Invisible characters are just stripped by cleanText.
export function textProblem(value: string, field: string): string | null {
  return /[<>{}`\\]/.test(value) ? `${field} can't contain ${BLOCKED_CHARS_LABEL}` : null;
}
