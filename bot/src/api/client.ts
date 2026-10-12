import { TtlCache } from "./cache.ts";
import type { BotEvent, BotLeaderboard, BotPlayer, BotUserStats, StandingsQuery } from "./types.ts";

// The dashboard's bot API over HTTPS. Every request carries the shared secret,
// gives up after `timeoutMs`, and is retried once when the failure looks
// temporary. Whatever goes wrong surfaces as an ApiError whose `kind` the
// commands turn into a message for the user (src/errors.ts).

export type ApiErrorKind =
  | "timeout" // no answer within the timeout
  | "network" // couldn't connect: DNS, refused, reset
  | "unauthorized" // 401/403: BOT_API_SECRET doesn't match the dashboard's
  | "unavailable" // the bot API's own 503: BOT_API_SECRET isn't set on the dashboard
  | "rate_limited" // 429
  | "not_found" // the bot API's own 404: no such event or player
  | "bad_request" // 400: the dashboard rejected the parameters
  | "server"; // any other failure, or a response that isn't the JSON expected

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    kind: ApiErrorKind,
    message: string,
    details: { status?: number; retryAfterSeconds?: number | null; cause?: unknown } = {}
  ) {
    super(message, { cause: details.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = details.status ?? null;
    this.retryAfterSeconds = details.retryAfterSeconds ?? null;
  }
}

export interface ApiClientOptions {
  baseUrl: URL; // ends with "/"
  secret: string;
  timeoutMs: number;
  retries?: number; // extra attempts after a timeout, network error or 502/503/504; default 1
}

// Events and players change rarely and feed autocomplete; standings are
// cached briefly so paging through a leaderboard doesn't refetch it.
const LIST_TTL_MS = 60_000;
const STANDINGS_TTL_MS = 30_000;
const USER_AGENT = "discord-points-bot/0.1";

// Gateway failures worth another try. The bot API's own 503 (with a JSON
// body) means it's switched off, which retrying won't change.
const RETRY_STATUSES = new Set([502, 503, 504]);

function isRetryable(err: ApiError): boolean {
  if (err.kind === "timeout" || err.kind === "network") return true;
  return err.kind === "server" && err.status !== null && RETRY_STATUSES.has(err.status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 300 ms, then 600 ms…, plus jitter so retries from several commands spread out.
function backoffMs(attempt: number): number {
  return 300 * 2 ** attempt + Math.random() * 200;
}

function isTimeout(err: unknown): boolean {
  return (err as { name?: unknown } | null)?.name === "TimeoutError";
}

// "ECONNREFUSED", "ENOTFOUND" and the like, from fetch's "fetch failed" error.
function networkReason(err: unknown): string {
  const cause = (err as { cause?: { code?: unknown; message?: unknown } } | null)?.cause;
  if (typeof cause?.code === "string") return cause.code;
  if (typeof cause?.message === "string") return cause.message;
  return err instanceof Error ? err.message : String(err);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// The bot API's `{ error }` message, when the response is one of its own.
function apiMessage(body: unknown): string | null {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === "string" ? error : null;
}

function retryAfterSeconds(header: string | null): number | null {
  const seconds = Number(header);
  return header && Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

function statusError(status: number, body: unknown, retryAfter: string | null, url: URL): ApiError {
  const own = apiMessage(body);
  const message = own ?? `HTTP ${status} from ${url.pathname}`;
  if (status === 400) return new ApiError("bad_request", message, { status });
  if (status === 401 || status === 403) return new ApiError("unauthorized", message, { status });
  if (status === 429) return new ApiError("rate_limited", message, { status, retryAfterSeconds: retryAfterSeconds(retryAfter) });
  // Without the API's JSON body, a 404 or 503 comes from the host, not the bot API.
  if (status === 404 && own) return new ApiError("not_found", own, { status });
  if (status === 404) {
    return new ApiError(
      "server",
      `No bot API at ${url.origin}${url.pathname} (HTTP 404). Check DASHBOARD_API_URL and that the dashboard is deployed with the bot routes.`,
      { status }
    );
  }
  if (status === 503 && own) return new ApiError("unavailable", own, { status });
  return new ApiError("server", message, { status });
}

function unexpectedShape(url: URL): ApiError {
  // The bot and the dashboard deploy separately; a mismatch shows up here
  // rather than as a crash halfway through building a reply.
  return new ApiError("server", `Unexpected response from ${url.pathname}. Are the bot and the dashboard on matching versions?`);
}

export function createApiClient({ baseUrl, secret, timeoutMs, retries = 1 }: ApiClientOptions) {
  const cache = new TtlCache();

  async function requestOnce(url: URL): Promise<Record<string, unknown>> {
    let status: number;
    let headers: Headers;
    let text: string;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${secret}`, Accept: "application/json", "User-Agent": USER_AGENT },
        // A redirect means DASHBOARD_API_URL is off (the dashboard sends
        // unknown pages to /login), and following one to another origin
        // would drop the Authorization header anyway.
        redirect: "manual",
        // Also covers reading the body, not just waiting for the headers.
        signal: AbortSignal.timeout(timeoutMs),
      });
      status = response.status;
      headers = response.headers;
      text = await response.text();
    } catch (err) {
      if (isTimeout(err)) {
        throw new ApiError("timeout", `No response from ${url.pathname} within ${timeoutMs} ms`, { cause: err });
      }
      throw new ApiError("network", `Couldn't reach ${url.origin}: ${networkReason(err)}`, { cause: err });
    }

    if (status >= 300 && status < 400) {
      throw new ApiError(
        "server",
        `${url.origin}${url.pathname} redirected to ${headers.get("location") ?? "another address"}. ` +
          "Set DASHBOARD_API_URL to the dashboard's own https:// address.",
        { status }
      );
    }
    const body = parseJson(text);
    if (status < 200 || status >= 300) throw statusError(status, body, headers.get("retry-after"), url);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ApiError("server", `${url.pathname} didn't answer with JSON (HTTP ${status})`, { status });
    }
    return body as Record<string, unknown>;
  }

  async function request(path: string, params: Record<string, string | undefined> = {}) {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    for (let attempt = 0; ; attempt++) {
      try {
        return { url, body: await requestOnce(url) };
      } catch (err) {
        if (!(err instanceof ApiError) || attempt >= retries || !isRetryable(err)) throw err;
        console.warn(`[api] ${err.message}; retrying (${attempt + 1}/${retries})`);
        await sleep(backoffMs(attempt));
      }
    }
  }

  function standingsParams({ event, timeframe, date }: StandingsQuery) {
    return { event_id: event, timeframe, date };
  }

  function standingsKey({ event, timeframe, date }: StandingsQuery): string {
    return `${event ?? "latest"}|${timeframe}|${date ?? "-"}`;
  }

  return {
    // Every event, newest first. An expired copy is served while it refreshes.
    events(): Promise<BotEvent[]> {
      return cache.get(
        "events",
        LIST_TTL_MS,
        async () => {
          const { url, body } = await request("api/bot/events");
          if (!Array.isArray(body.events)) throw unexpectedShape(url);
          return body.events as BotEvent[];
        },
        { staleWhileRevalidate: true }
      );
    },

    // Every player, A→Z. An expired copy is served while it refreshes.
    players(): Promise<BotPlayer[]> {
      return cache.get(
        "players",
        LIST_TTL_MS,
        async () => {
          const { url, body } = await request("api/bot/players");
          if (!Array.isArray(body.players)) throw unexpectedShape(url);
          return body.players as BotPlayer[];
        },
        { staleWhileRevalidate: true }
      );
    },

    leaderboard(query: StandingsQuery): Promise<BotLeaderboard> {
      return cache.get(`leaderboard|${standingsKey(query)}`, STANDINGS_TTL_MS, async () => {
        const { url, body } = await request("api/bot/leaderboard", standingsParams(query));
        if (!Array.isArray(body.rows) || typeof (body.period as { label?: unknown })?.label !== "string") {
          throw unexpectedShape(url);
        }
        return body as unknown as BotLeaderboard;
      });
    },

    userStats(player: string, query: StandingsQuery): Promise<BotUserStats> {
      return cache.get(`user-stats|${player}|${standingsKey(query)}`, STANDINGS_TTL_MS, async () => {
        const { url, body } = await request("api/bot/user-stats", { player, ...standingsParams(query) });
        if (!body.player || !Array.isArray(body.breakdown) || typeof (body.period as { label?: unknown })?.label !== "string") {
          throw unexpectedShape(url);
        }
        return body as unknown as BotUserStats;
      });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
