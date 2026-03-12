import Redis from "ioredis";

const getRedisClient = () => {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  return new Redis(url, {
    maxRetriesPerRequest: 3,
  });
};

// Singleton: reuse connection across hot reloads in dev
const globalForRedis = globalThis as unknown as { redis?: Redis };
const redis = globalForRedis.redis ?? getRedisClient();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export default redis;
