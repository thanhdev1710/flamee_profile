import Redis from "ioredis";
import { env } from "../config/env";

const redisUrl = env.redis;
export const redis = new Redis(redisUrl);
