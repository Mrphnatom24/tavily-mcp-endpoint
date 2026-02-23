import { redisCache } from './redis';

/**
 * Perform a rate limit check using Redis
 * @param key Identifier for the rate limit (e.g., 'rl:duckduckgo')
 * @param limit Maximum number of requests allowed
 * @param windowSeconds Time window in seconds
 * @returns {Promise<boolean>} True if allowed, false if rate limited
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const client = redisCache.client;

    // If Redis is not available, we allow the request to proceed (fail-open)
    // but you might want to fail-closed depending on your requirements.
    if (!client) return true;

    try {
        const current = await client.incr(key);

        if (current === 1) {
            // First request in this window, set expiration
            await client.expire(key, windowSeconds);
        }

        return current <= limit;
    } catch (error) {
        console.error(`[RATELIMIT] Error checking limit for ${key}:`, error);
        return true; // Fail-open on error
    }
}

/**
 * Get current rate limit stats for a key
 */
export async function getRateLimitStats(key: string) {
    const client = redisCache.client;
    if (!client) return null;

    const [count, ttl] = await Promise.all([
        client.get(key),
        client.ttl(key)
    ]);

    return {
        count: count ? parseInt(count) : 0,
        ttl: ttl > 0 ? ttl : 0
    };
}
