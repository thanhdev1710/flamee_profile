import express from "express";
import {
  checkFriendStatus,
  addOrUnFollow,
  getFriendSuggestions,
} from "../controllers/follow.controller";
import { verifyToken } from "../middlewares/jwt";

const router = express.Router();

router.route("/check-friend").post(checkFriendStatus);

router.use(verifyToken);
router.route("/friend_suggestions").get(getFriendSuggestions);
router.route("/").post(addOrUnFollow);

export default router;
