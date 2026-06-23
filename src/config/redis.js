const Redis = require("ioredis");
const logger = require("../utils/logger");

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: true,
    });

    await redisClient.connect();
    logger.info("✅ Redis Connected");

    redisClient.on("error", (err) => {
      logger.error("Redis error:", err.message);
    });

    redisClient.on("reconnecting", () => {
      logger.warn("Redis reconnecting...");
    });
  } catch (error) {
    logger.warn(`Redis connection failed: ${error.message}. Running without cache.`);
    redisClient = null;
  }
};

const getRedis = () => redisClient;

const setCache = async (key, value, ttl = parseInt(process.env.REDIS_TTL) || 3600) => {
  if (!redisClient) return null;
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    logger.error("Redis setCache error:", err.message);
  }
};

const getCache = async (key) => {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error("Redis getCache error:", err.message);
    return null;
  }
};

const deleteCache = async (key) => {
  if (!redisClient) return null;
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.error("Redis deleteCache error:", err.message);
  }
};

const deleteCachePattern = async (pattern) => {
  if (!redisClient) return null;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) await redisClient.del(...keys);
  } catch (err) {
    logger.error("Redis deleteCachePattern error:", err.message);
  }
};

module.exports = { connectRedis, getRedis, setCache, getCache, deleteCache, deleteCachePattern };
module.exports.default = connectRedis;
