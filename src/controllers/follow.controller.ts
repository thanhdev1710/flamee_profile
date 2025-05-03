import { sendResponse } from "../response/apiResponse";
import userService from "../services/user.service";
import { CheckUserId } from "../types/user.type";
import AppError from "../utils/error/AppError";
import CatchAsync from "../utils/error/CatchAsync";
import { getUserLogin } from "../utils/helper";

export const checkFriendStatus = CatchAsync(async (req, res, next) => {
  const userId1 = CheckUserId(req.body.userId1);
  const userId2 = CheckUserId(req.body.userId2);

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

export const addOrUnFollow = CatchAsync(async (req, res, next) => {
  const { userId } = getUserLogin(req);
  const { leaderId } = req.body;

  const leader_id = CheckUserId(leaderId);
  const follower_id = CheckUserId(userId);

  const message = await userService.addOrUnFriend(leader_id, follower_id);

  sendResponse(res, 201, message);
});

export const getFriendSuggestions = CatchAsync(async (req, res, next) => {
  const { userId } = getUserLogin(req);
  const { page = 1 } = req.query;
  if (Number(page) < 0) {
    throw new AppError("Page không hợp lệ", 400);
  }
  const user_id = CheckUserId(userId);

  const friendSuggestions = await userService.getFriendSuggestions(
    user_id,
    10,
    (Number(page) - 1) * 10
  );

  sendResponse(res, 200, "Danh sách gợi ý bạn bè", {
    page,
    ...friendSuggestions,
  });
});
