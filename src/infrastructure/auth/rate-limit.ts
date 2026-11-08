/**
 * Limiteur mémoire simple anti force-brute (login).
 * Adapté au prototype ; pour multi-instances Vercel, remplacer par Redis/Upstash.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function assertLoginRateLimit(key: string): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (existing.count >= MAX_ATTEMPTS) {
    throw new Error(
      "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
    );
  }
  existing.count += 1;
}

export function clearLoginRateLimit(key: string): void {
  buckets.delete(key);
}

/** Réservé aux tests. */
export function resetLoginRateLimitForTests(): void {
  buckets.clear();
}
