import { createClient } from 'redis';

let useInMemory = true;
const memoryStore = new Map<string, string>();
let redisClient: ReturnType<typeof createClient> | null = null;

export async function initRedis() {
  const REDIS_URL = process.env.REDIS_URL;

  if (!REDIS_URL) {
    console.warn('REDIS_URL is not set. Falling back to IN-MEMORY chamber store.');
    useInMemory = true;
    return;
  }

  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
      console.warn('Failed to connect to Redis. Falling back to IN-MEMORY chamber store.');
      useInMemory = true;
    });

    await redisClient.connect();
    console.log('Successfully connected to Redis database.');
    useInMemory = false;
  } catch (error) {
    console.error('Redis initialization failed:', error);
    console.warn('Falling back to IN-MEMORY chamber store.');
    useInMemory = true;
  }
}

export async function setVal(key: string, value: string, expireSeconds?: number): Promise<void> {
  if (useInMemory || !redisClient) {
    memoryStore.set(key, value);
    if (expireSeconds) {
      setTimeout(() => {
        memoryStore.delete(key);
      }, expireSeconds * 1000);
    }
    return;
  }
  
  try {
    if (expireSeconds) {
      await redisClient.setEx(key, expireSeconds, value);
    } else {
      await redisClient.set(key, value);
    }
  } catch (err) {
    console.error('Redis SET error:', err);
    memoryStore.set(key, value);
  }
}

export async function getVal(key: string): Promise<string | null> {
  if (useInMemory || !redisClient) {
    return memoryStore.get(key) || null;
  }
  try {
    return await redisClient.get(key);
  } catch (err) {
    console.error('Redis GET error:', err);
    return memoryStore.get(key) || null;
  }
}

export async function delVal(key: string): Promise<void> {
  if (useInMemory || !redisClient) {
    memoryStore.delete(key);
    return;
  }
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error('Redis DEL error:', err);
    memoryStore.delete(key);
  }
}
