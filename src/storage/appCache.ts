export type CacheEntry<T> = {
  value: T;
  cachedAt: number;
};

export type PersistentCacheStore<T> = {
  get: (key: string) => Promise<CacheEntry<T> | null> | CacheEntry<T> | null;
  set: (key: string, entry: CacheEntry<T>) => Promise<void> | void;
  delete?: (key: string) => Promise<void> | void;
};

type AppCacheOptions<T> = {
  namespace: string;
  persistentStore?: PersistentCacheStore<T>;
  maxMemoryEntries?: number;
};

export class AppCache<T> {
  private namespace: string;
  private persistentStore?: PersistentCacheStore<T>;
  private maxMemoryEntries: number;
  private memoryCache = new Map<string, CacheEntry<T>>();
  private inflightRequests = new Map<string, Promise<T>>();

  constructor(options: AppCacheOptions<T>) {
    this.namespace = options.namespace;
    this.persistentStore = options.persistentStore;
    this.maxMemoryEntries = options.maxMemoryEntries ?? 64;
  }

  private buildNamespacedKey(key: string) {
    return `${this.namespace}:${key}`;
  }

  private remember(key: string, entry: CacheEntry<T>) {
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
    }

    this.memoryCache.set(key, entry);

    while (this.memoryCache.size > this.maxMemoryEntries) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (!oldestKey) break;
      this.memoryCache.delete(oldestKey);
    }
  }

  async get(key: string): Promise<T | null> {
    const namespacedKey = this.buildNamespacedKey(key);
    const fromMemory = this.memoryCache.get(namespacedKey);

    if (fromMemory) {
      return fromMemory.value;
    }

    if (!this.persistentStore) {
      return null;
    }

    const entry = await this.persistentStore.get(namespacedKey);
    if (!entry) {
      return null;
    }

    this.remember(namespacedKey, entry);
    return entry.value;
  }

  async set(key: string, value: T) {
    const namespacedKey = this.buildNamespacedKey(key);
    const entry = { value, cachedAt: Date.now() };
    this.remember(namespacedKey, entry);

    if (this.persistentStore) {
      await this.persistentStore.set(namespacedKey, entry);
    }
  }

  async getOrLoad(key: string, loader: () => Promise<T>) {
    const cached = await this.get(key);
    if (cached) {
      return cached;
    }

    const namespacedKey = this.buildNamespacedKey(key);
    const existingPromise = this.inflightRequests.get(namespacedKey);
    if (existingPromise) {
      return existingPromise;
    }

    const request = loader()
      .then(async (value) => {
        await this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inflightRequests.delete(namespacedKey);
      });

    this.inflightRequests.set(namespacedKey, request);
    return request;
  }

  async prefetch(key: string, loader: () => Promise<T>) {
    try {
      await this.getOrLoad(key, loader);
    } catch {}
  }
}
