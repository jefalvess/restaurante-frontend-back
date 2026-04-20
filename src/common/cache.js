class Cache {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttlSeconds = 300) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  invalidate(pattern) {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }

  stats() {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

module.exports = new Cache();
