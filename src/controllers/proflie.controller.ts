import { exists } from "fs";
import { redis } from "../lib/redis";
import { sendResponse } from "../response/apiResponse";
import userService from "../services/user.service";
import UserService from "../services/user.service";
import { CreateUserType } from "../types/user.type";
import AppError from "../utils/error/AppError";
import CatchAsync from "../utils/error/CatchAsync";
import { getUserLogin } from "../utils/helper";
import { generateUsernameSuggestion } from "../utils/utils";

export const createProfile = CatchAsync(async (req, res, next) => {
  const { email, userId } = getUserLogin(req);
  const body: CreateUserType = {
    ...req.body,
    user_id: userId,
    email,
  };

  const user = await UserService.create(body);

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

  sendResponse(res, 201, "Cập nhật thông tin cá nhân thành công", user);
});

export const suggestUsername = CatchAsync(async (req, res, next) => {
  const { base } = req.params;
  const { email } = getUserLogin(req);

  const emailBase = email.split("@")[0].toLowerCase();
  const baseInput = base?.trim().toLowerCase() || emailBase;

  const suggestions = new Set<string>();

  // Ưu tiên gợi ý tên từ email nếu chưa bị dùng
  const emailUsed = await redis.sismember("usernames", `@${emailBase}`);
  if (!emailUsed) {
    suggestions.add(emailBase);
  }

  // Gợi ý thêm 2 tên không trùng
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
  const normalizedKeyword = keyword.toLowerCase();

  // Kiểm tra keyword có bắt đầu bằng '@' chưa
  if (!normalizedKeyword.startsWith("@")) {
    throw new AppError("Phải có chữ @ mới tìm kiếm", 400);
  }

  // Tìm kiếm người dùng
  const data = await userService.searchUsername(userId, normalizedKeyword);

  const key = `search_history:${userId}`;
  // Xoá nếu đã tồn tại để tránh trùng
  await redis.lrem(key, 0, normalizedKeyword);
  // Thêm mới vào đầu danh sách
  await redis.lpush(key, normalizedKeyword);
  // Giới hạn chỉ giữ 3 từ khoá gần nhất
  await redis.ltrim(key, 0, 2);

  // Kiểm tra có tìm thấy người dùng không
  if (!data || data.length === 0) {
    throw new AppError("Không tìm thấy người dùng phù hợp", 404);
  }

  // Trả kết quả tìm kiếm
  sendResponse(res, 200, "Danh sách các người dùng được tìm thấy", data);
});

export const getSearchHistory = CatchAsync(async (req, res, next) => {
  const { userId } = getUserLogin(req);
  const key = `search_history:${userId}`;

  const data = await redis.lrange(key, 0, -1);

  sendResponse(res, 200, "Danh sách lịch sử tìm kiếm", data);
});

export const setUserOnline = CatchAsync(async (req, res, next) => {
  const { userId } = getUserLogin(req);

  await userService.setUserOnline(userId);

  sendResponse(res, 200, "Cập nhật trạng thái thành công");
});

export const isUserOnline = CatchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const isOnline = await userService.isUserOnline(userId);

  sendResponse(res, 200, "Kiểm tra trạng thái thành công", {
    isOnline,
  });
});
