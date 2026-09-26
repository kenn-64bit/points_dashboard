import { NextResponse } from "next/server";

// Postgres error codes that indicate a client-caused (4xx) problem rather than
// a genuine server failure — see https://www.postgresql.org/docs/current/errcodes-appendix.html
const POSTGRES_STATUS: Record<string, number> = {
  "23505": 409, // unique_violation
  "23503": 400, // foreign_key_violation
  "23514": 400, // check_violation
  "22003": 400, // numeric_value_out_of_range
  "22P02": 400, // invalid_text_representation (e.g. bad uuid/date)
};

// Every route handler funnels its errors through here instead of returning
// raw DB/exception messages with a hardcoded 500 — logs the real error
// server-side (the only observability this app has) and maps known
// client-caused Postgres errors to the right status code.
export function errorResponse(err: unknown, fallbackMessage = "Something went wrong") {
  console.error(err);
  const code = (err as { code?: string } | null)?.code;
  const status = (code && POSTGRES_STATUS[code]) || 500;
  const message =
    status === 500 ? fallbackMessage : (err as { message?: string } | null)?.message ?? fallbackMessage;
  return NextResponse.json({ error: message }, { status });
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Your session has expired — please sign in again." }, { status: 401 });
}
