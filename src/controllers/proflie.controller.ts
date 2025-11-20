import { redis } from "../lib/redis";
import { sendResponse } from "../response/apiResponse";
import EventService from "../services/event.service";
import UserService from "../services/user.service";
import { CreateUserType } from "../types/user.type";
import AppError from "../utils/error/AppError";
import CatchAsync from "../utils/error/CatchAsync";
import { getUserLogin } from "../utils/helper";
import { generateUsernameSuggestion } from "../utils/utils";

// Helper build payload cho Elasticsearch từ profile trả về
const buildUserSearchPayload = (user: any) => {
  const interests =
    user.interests?.map((i: any) => i.interest?.name || i.interest || i.name) ||
    [];

  return {
    id: user.user_id,
    username: user.username,
    fullname: `${user.firstName} ${user.lastName}`.trim(),
    avatar_url: user.avatar_url,
    bio: user.bio,
    course: user.course || "",
    major: user.major || "",
    interests,
    // Followers / Following sẽ được cập nhật thêm từ follow-controller sau
    followers: 0,
    following: 0,
  };
};

export const createProfile = CatchAsync(async (req, res, next) => {
  const { email, userId } = getUserLogin(req);
  const body: CreateUserType = {
    ...req.body,
    user_id: userId,
    email,
  };

  const user = await UserService.create(body);

  // Sự kiện cũ của bạn (nếu đang dùng cho hệ thống khác)
  await Promise.all([
    EventService.publishProfileCreated(user.user_id),
    EventService.publishProfileUpdated({
      firstname: user.firstName,
      lastname: user.lastName,
      user_id: user.user_id,
      username: user.username,
      avatar: user.avatar_url,
    }),
  ]);

  // ✅ Thêm: publish lên SearchService / Elasticsearch
  const searchPayload = buildUserSearchPayload(user);
  await EventService.publishUserSearchUpsert(searchPayload); // user.created

  sendResponse(res, 201, "Tạo thông tin cá nhân thành công", user);
});

export const getProfile = CatchAsync(async (req, res, next) => {
  const { userId } = getUserLogin(req);

  const user = await UserService.findByUserId(userId);

  sendResponse(res, 200, "Lấy thông tin cá nhân thành công", user);
});

export const updateProfile = CatchAsync(async (req, res, next) => {
  const { email, userId } = getUserLogin(req);
  const body: CreateUserType = {
    ...req.body,
    user_id: userId,
    email,
  };

  const user = await UserService.update(body);

  // Event cũ của bạn
  await EventService.publishProfileUpdated({
    firstname: user.firstName,
    lastname: user.lastName,
    user_id: user.user_id,
    username: user.username,
    avatar: user.avatar_url,
  });

  // ✅ Thêm: cập nhật index user trong Elasticsearch
  const searchPayload = buildUserSearchPayload(user);
  await EventService.publishUserSearchUpsert(searchPayload); // user.updated

  sendResponse(res, 201, "Cập nhật thông tin cá nhân thành công", user);
});

export const suggestUsername = CatchAsync(async (req, res, next) => {
  const { base } = req.params;
  const { email } = getUserLogin(req);

  const emailBase = email.split("@")[0].toLowerCase();
  const baseInput = base?.trim().toLowerCase() || emailBase;

  const suggestions = new Set<string>();

  const emailUsed = await redis.sismember("usernames", `@${emailBase}`);
  if (!emailUsed) {
    suggestions.add(emailBase);
  }

  while (suggestions.size < 3) {
    const suggestion = await generateUsernameSuggestion(baseInput);
    suggestions.add(suggestion);
  }

  sendResponse(
    res,
    200,
    "Tên đã được dùng. Gợi ý tên thay thế",
    Array.from(suggestions)
  );
});

export const searchUsername = CatchAsync(async (req, res, next) => {
  const { keyword } = req.params;
  const { userId } = getUserLogin(req);
  const { page, limit } = req.query;
  const normalizedKeyword = keyword.toLowerCase();

  if (!normalizedKeyword.startsWith("@")) {
    throw new AppError("Phải có chữ @ mới tìm kiếm", 400);
  }

  const data = await UserService.searchUsername(
    userId,
    normalizedKeyword,
    Number(page) || 1,
    Number(limit) || 5
  );

  const key = `search_history:${userId}`;
  await redis.lrem(key, 0, normalizedKeyword);
  await redis.lpush(key, normalizedKeyword);
  await redis.ltrim(key, 0, 2);

  if (!data || data.length === 0) {
    sendResponse(res, 200, "Danh sách các người dùng được tìm thấy", {
      data: [],
    });
  }

  sendResponse(res, 200, "Danh sách các người dùng được tìm thấy", data);
});

export const getSearchHistory = CatchAsync(async (req, res, next) => {
  const { userId } = getUserLogin(req);
  const key = `search_history:${userId}`;

  const data = await redis.lrange(key, 0, -1);

  sendResponse(res, 200, "Danh sách lịch sử tìm kiếm", data);
});

export const getFriendStatuses = CatchAsync(async (req, res, next) => {
  const { userId } = getUserLogin(req);

  const friendIds = await UserService.getFriendIds(userId);

  if (!friendIds || friendIds.length === 0) {
    return sendResponse(res, 200, "Bạn chưa có bạn bè nào", null);
  }

  const pipeline = redis.multi();
  friendIds.forEach((id) => pipeline.sismember("online_users", id));

  const results = await pipeline.exec();

  if (!results) {
    throw new AppError("Không thể kiểm tra trạng thái online", 500);
  }

  const statuses: Record<string, boolean> = {};
  friendIds.forEach((id, idx) => {
    const isOnline = results[idx]?.[1];
    statuses[id] = Boolean(isOnline);
  });

  sendResponse(res, 200, "Trạng thái online của bạn bè", statuses);
});
