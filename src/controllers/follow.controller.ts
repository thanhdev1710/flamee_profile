import { sendResponse } from "../response/apiResponse";
import userService from "../services/user.service";
import { createUserSchema } from "../types/user.type";
import AppError from "../utils/error/AppError";
import CatchAsync from "../utils/error/CatchAsync";

export const checkFriendStatus = CatchAsync(async (req, res, next) => {
  const idSchema = createUserSchema.pick({ user_id: true });

  const check1 = idSchema.safeParse({ user_id: req.body.userId1 });
  const check2 = idSchema.safeParse({ user_id: req.body.userId2 });

  if (!check1.success || !check2.success) {
    throw new AppError("ID người dùng không hợp lệ", 400);
  }

  const userId1 = check1.data.user_id;
  const userId2 = check2.data.user_id;

  if (userId1 === userId2) {
    throw new AppError("ID không được trùng nhau", 400);
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
