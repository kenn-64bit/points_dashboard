// Prints a ready-to-paste SQL statement that adds (or updates) a roster member
// in app_users. Run with `npm run hash-password`, then paste the output into
// the Supabase SQL Editor. Requires Node 22.18+ (imports the .ts module below
// via Node's built-in type stripping).
// Mainly for creating the first admin — after that, admins can manage the
// roster from the Team page (/dashboard/team).
import readline from "node:readline";
import { hashPassword } from "../lib/auth/password.ts";

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Swallow echoed keystrokes, but still print the prompt itself.
      rl._writeToOutput = (str) => {
        if (str.startsWith(question)) rl.output.write(question);
      };
    }
    rl.question(question, (answer) => {
      if (hidden) rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

const sqlString = (value) => `'${value.replace(/'/g, "''")}'`;

const email = (await ask("Email: ")).trim().toLowerCase();
if (!email.includes("@")) {
  console.error("That doesn't look like an email address.");
  process.exit(1);
}

const password = await ask("Password (input hidden): ", { hidden: true });
if (password.length < 8) {
  console.error("Use a password of at least 8 characters.");
  process.exit(1);
}
const confirm = await ask("Confirm password: ", { hidden: true });
if (confirm !== password) {
  console.error("Passwords don't match.");
  process.exit(1);
}

// Keep in sync with APP_USER_ROLES in lib/auth/roles.ts.
const ROLES = ["admin", "editor", "viewer"];
const roleInput = (await ask("Role [admin/editor/viewer] (default: admin): ")).trim().toLowerCase() || "admin";
if (!ROLES.includes(roleInput)) {
  console.error('Role must be "admin", "editor" or "viewer".');
  process.exit(1);
}

const hash = await hashPassword(password);

console.log("\nPaste this into the Supabase SQL Editor:\n");
console.log(
  `insert into app_users (email, password_hash, role)\n` +
    `values (${sqlString(email)}, ${sqlString(hash)}, ${sqlString(roleInput)})\n` +
    `on conflict (email) do update set password_hash = excluded.password_hash, role = excluded.role;\n`
);
