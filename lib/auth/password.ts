import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Password hashing via Node's built-in scrypt — no native dependency. Stored
// format is `scrypt$<saltB64>$<hashB64>`. This file deliberately imports only
// node:crypto (no `@/` aliases, no `server-only`) so scripts/hash-password.mjs
// can import it directly with Node's built-in TypeScript type stripping.

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (err, derived) => (err ? reject(err) : resolve(derived)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Verified against when the submitted email isn't on the roster, so a login
// attempt takes the same time whether or not the email exists.
export const DUMMY_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
