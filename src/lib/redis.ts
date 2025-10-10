import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"; // fallback nếu env không set
export const redis = new Redis(redisUrl);
