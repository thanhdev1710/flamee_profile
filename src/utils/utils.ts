import { redis } from "../lib/redis";
import { CheckUsername, createUserSchema } from "../types/user.type";
import AppError from "./error/AppError";

const adjectives = ["cool", "fast", "funny", "lucky", "crazy", "epic", "blue"];
const nouns = ["tiger", "panda", "lion", "ninja", "dragon", "wizard", "fox"];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generateUsernameSuggestion(base: string) {
  // Trim trước khi validate
  const trimmedBase = CheckUsername(base);

  const formattedBase = trimmedBase.toLowerCase();

  // Nếu chưa bị dùng => Không cần gợi ý
  const existedBase = await redis.sismember("usernames", "@" + formattedBase);
  if (!existedBase) {
    throw new AppError("Tên này vẫn sử dụng được, không cần gợi ý", 400);
  }

  // Thử tạo gợi ý username mới
  for (let i = 0; i < 10; i++) {
    const adj = getRandomItem(adjectives);
    const noun = getRandomItem(nouns);
    const suffix = Math.floor(Math.random() * 1000);
    const candidate = `${formattedBase}_${noun}_${adj}_${suffix}`;

    const parseCandidate = createUserSchema.pick({ username: true }).safeParse({
      username: candidate,
    });

    if (!parseCandidate.success) {
      continue;
    }

    const exists = await redis.sismember("usernames", "@" + candidate);
    if (!exists) {
      return candidate;
    }
  }

  throw new AppError("Không thể tạo tên gợi ý sau nhiều lần thử", 500);
}
