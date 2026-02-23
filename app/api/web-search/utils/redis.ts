import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

class RedisCache {
    public client: Redis | null = null;
    private isConnected = false;

    constructor() {
        if (redisUrl) {
            try {
                this.client = new Redis(redisUrl, {
                    maxRetriesPerRequest: 3,
                    connectTimeout: 5000,
                    // Reconnect strategy
                    retryStrategy(times) {
                        const delay = Math.min(times * 50, 2000);
                        return delay;
                    }
                });

                this.client.on('connect', () => {
                    this.isConnected = true;
                    console.log('✅ [REDIS] Connected successfully');
                });

                this.client.on('error', (err) => {
                    this.isConnected = false;
                    console.error('❌ [REDIS] Connection error:', err.message);
                });
            } catch (error) {
                console.error('❌ [REDIS] Failed to initialize client');
            }
        } else {
            console.warn('⚠️ [REDIS] REDIS_URL not defined, cache will be disabled');
        }
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.client || !this.isConnected) return null;
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`[REDIS] Get error for key ${key}:`, error);
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
        if (!this.client || !this.isConnected) return;
        try {
            await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch (error) {
            console.error(`[REDIS] Set error for key ${key}:`, error);
        }
    }

    async del(key: string): Promise<void> {
        if (!this.client || !this.isConnected) return;
        try {
            await this.client.del(key);
        } catch (error) {
            console.error(`[REDIS] Delete error for key ${key}:`, error);
        }
    }
}

export const redisCache = new RedisCache();
