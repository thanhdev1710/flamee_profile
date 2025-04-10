import { redis } from "../lib/redis";
import { sendResponse } from "../response/apiResponse";
import { HTTP_STATUS } from "../response/httpStatusCode";
import userService from "../services/user.service";
import UserService from "../services/user.service";
import { CreateUserType } from "../types/user.type";
import AppError from "../utils/error/AppError";
import CatchAsync from "../utils/error/CatchAsync";
import { generateUsernameSuggestion } from "../utils/utils";

export const createProfile = CatchAsync(async (req, res, next) => {
  const userId = (req as any).user?.sub;
  const email = (req as any).user?.email;
  if (!userId || !email) {
    throw new AppError("Vui lòng đăng nhập", HTTP_STATUS.FORBIDDEN);
  }
  const body: CreateUserType = {
    ...req.body,
    user_id: userId,
    email,
  };

  const user = await UserService.create(body);

  sendResponse(res, 201, "Tạo thông tin cá nhân thành công", user);
});

export const getProfile = CatchAsync(async (req, res, next) => {
  const userId = (req as any).user?.sub;
  if (!userId) {
    throw new AppError("Vui lòng đăng nhập", HTTP_STATUS.FORBIDDEN);
  }

  const user = await UserService.findByUserId(userId);

  sendResponse(res, 200, "Lấy thông tin cá nhân thành công", user);
});

export const updateProfile = CatchAsync(async (req, res, next) => {
  const userId = (req as any).user?.sub;
  const email = (req as any).user?.email;
  if (!userId || !email) {
    throw new AppError("Vui lòng đăng nhập", HTTP_STATUS.FORBIDDEN);
  }
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
  const userId = (req as any).user?.sub;
  const email = (req as any).user?.email;

  if (!userId || !email) {
    throw new AppError("Vui lòng đăng nhập", HTTP_STATUS.FORBIDDEN);
  }

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
  const userId = (req as any).user?.sub;
  const email = (req as any).user?.email;

  // Kiểm tra đăng nhập
  if (!userId || !email) {
    throw new AppError("Vui lòng đăng nhập", HTTP_STATUS.FORBIDDEN);
  }

  // Kiểm tra keyword có bắt đầu bằng '@' chưa
  if (!keyword.startsWith("@")) {
    throw new AppError("Phải có chữ @ mới tìm kiếm", HTTP_STATUS.BAD_REQUEST);
  }

  // Tìm kiếm người dùng
  const data = await userService.searchUsername(userId, keyword);

  // Kiểm tra có tìm thấy người dùng không
  if (!data || data.length === 0) {
    throw new AppError(
      "Không tìm thấy người dùng phù hợp",
      HTTP_STATUS.NOT_FOUND
    );
  }

  // Trả kết quả tìm kiếm
  sendResponse(res, 200, "Danh sách các người dùng được tìm thấy", data);
});

export const checkFriendStatus = CatchAsync(async (req, res, next) => {
  const { userId1, userId2 } = req.params;

  if (!userId1 || !userId2) {
    throw new AppError("Thiếu thông tin người dùng", HTTP_STATUS.BAD_REQUEST);
  }

  const isFriend = await userService.checkFriendship(userId1, userId2);

  if (isFriend) {
    sendResponse(res, 200, "Hai người là bạn bè", { isFriend: true });
  } else {
    sendResponse(res, 200, "Hai người không phải là bạn bè", {
      isFriend: false,
    });
  }
});
