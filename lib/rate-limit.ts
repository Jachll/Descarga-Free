const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 25);

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

export function checkRateLimit(key: string) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || now > current.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1 };
  }

  if (current.count >= MAX_REQUESTS) {
    return { ok: false, remaining: 0, retryInMs: current.resetAt - now };
  }

  current.count += 1;
  return { ok: true, remaining: MAX_REQUESTS - current.count };
}
