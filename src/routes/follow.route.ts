import express from "express";
import { checkFriendStatus } from "../controllers/follow.controller";

const router = express.Router();

router.route("/check-friend").post(checkFriendStatus);

export default router;
