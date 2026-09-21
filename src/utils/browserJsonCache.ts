const CACHE_PREFIX = 'json_cache:';

interface BrowserJsonCacheEntry<T> {
  expiresAt: number;
  value: T;
}

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const browserJsonCache = {
  get<T>(key: string): T | null {
    if (!isBrowser) {
      return null;
    }

    try {
      const rawValue = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!rawValue) {
        return null;
      }

      const entry = JSON.parse(rawValue) as BrowserJsonCacheEntry<T>;
      if (!entry?.expiresAt || Date.now() > entry.expiresAt) {
        window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }

      return entry.value;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T, ttlMs: number): void {
    if (!isBrowser) {
      return;
    }

    const entry: BrowserJsonCacheEntry<T> = {
      expiresAt: Date.now() + ttlMs,
      value,
    };

    try {
      window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch {
      // Ignore quota errors and continue without cache.
    }
  },

  remove(key: string): void {
    if (!isBrowser) {
      return;
    }

    window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  },
};
