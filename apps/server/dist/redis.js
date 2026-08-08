"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRedis = initRedis;
exports.setVal = setVal;
exports.getVal = getVal;
exports.delVal = delVal;
const redis_1 = require("redis");
let useInMemory = true;
const memoryStore = new Map();
let redisClient = null;
async function initRedis() {
    const REDIS_URL = process.env.REDIS_URL;
    if (!REDIS_URL) {
        console.warn('REDIS_URL is not set. Falling back to IN-MEMORY chamber store.');
        useInMemory = true;
        return;
    }
    try {
        redisClient = (0, redis_1.createClient)({ url: REDIS_URL });
        redisClient.on('error', (err) => {
            console.error('Redis client error:', err);
            console.warn('Failed to connect to Redis. Falling back to IN-MEMORY chamber store.');
            useInMemory = true;
        });
        await redisClient.connect();
        console.log('Successfully connected to Redis database.');
        useInMemory = false;
    }
    catch (error) {
        console.error('Redis initialization failed:', error);
        console.warn('Falling back to IN-MEMORY chamber store.');
        useInMemory = true;
    }
}
async function setVal(key, value, expireSeconds) {
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
        }
        else {
            await redisClient.set(key, value);
        }
    }
    catch (err) {
        console.error('Redis SET error:', err);
        memoryStore.set(key, value);
    }
}
async function getVal(key) {
    if (useInMemory || !redisClient) {
        return memoryStore.get(key) || null;
    }
    try {
        return await redisClient.get(key);
    }
    catch (err) {
        console.error('Redis GET error:', err);
        return memoryStore.get(key) || null;
    }
}
async function delVal(key) {
    if (useInMemory || !redisClient) {
        memoryStore.delete(key);
        return;
    }
    try {
        await redisClient.del(key);
    }
    catch (err) {
        console.error('Redis DEL error:', err);
        memoryStore.delete(key);
    }
}
//# sourceMappingURL=redis.js.map