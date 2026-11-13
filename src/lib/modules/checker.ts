/**
 * Small in-memory cache for module checks. A change made in the Superadmin
 * reaches each server instance within `ttlMs`. Failures are never cached and
 * always evaluate as inactive, so a problem reading modules cannot break an
 * existing flow.
 */
export function createModuleChecker(options: { ttlMs?: number; timeoutMs?: number; now?: () => number } = {}) {
  const ttlMs = options.ttlMs ?? 30_000;
  const timeoutMs = options.timeoutMs ?? 2_000;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { value: boolean; expiresAt: number }>();

  async function check(cacheKey: string, load: () => Promise<boolean>): Promise<boolean> {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.value;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        load(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("module check timed out")), timeoutMs);
        })
      ]);
      cache.set(cacheKey, { value: value === true, expiresAt: now() + ttlMs });
      return value === true;
    } catch {
      cache.delete(cacheKey);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { check, clear: () => cache.clear() };
}
