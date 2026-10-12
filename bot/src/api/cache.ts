// A small in-memory cache for dashboard responses. Requests for the same key
// that overlap share one fetch. With `staleWhileRevalidate`, an expired entry
// is returned at once while a fresh copy loads in the background, because
// autocomplete has to answer Discord within 3 seconds.

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class TtlCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string, ttlMs: number, load: () => Promise<T>, options: { staleWhileRevalidate?: boolean } = {}): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > Date.now()) return Promise.resolve(entry.value as T);
    if (entry && options.staleWhileRevalidate) {
      // The stale copy stands until a refresh succeeds; the request logs its own failure.
      this.refresh(key, ttlMs, load).catch(() => {});
      return Promise.resolve(entry.value as T);
    }
    return this.refresh(key, ttlMs, load);
  }

  // Whatever is cached for `key`, fresh or stale, without loading anything.
  peek<T>(key: string): T | undefined {
    return this.entries.get(key)?.value as T | undefined;
  }

  private refresh<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = load()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private set(key: string, value: unknown, ttlMs: number): void {
    // Re-inserting moves the key to the end; Map keeps insertion order, so
    // the first key is always the oldest.
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
