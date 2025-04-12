import express from "express";
import {
  checkFriendStatus,
  addOrUnFollow,
} from "../controllers/follow.controller";
import { verifyToken } from "../middlewares/jwt";

const router = express.Router();

router.route("/check-friend").post(checkFriendStatus);

router.use(verifyToken);
router.route("/").post(addOrUnFollow);

export default router;
