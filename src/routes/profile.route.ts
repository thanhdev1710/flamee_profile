import express from "express";
import {
  checkFriendStatus,
  createProfile,
  getProfile,
  searchUsername,
  suggestUsername,
  updateProfile,
} from "../controllers/proflie.controller";
import { verifyToken } from "../middlewares/jwt";

const router = express.Router();

router.route("/check-friend").post(checkFriendStatus);

router.use(verifyToken);

router.route("/").get(getProfile).post(createProfile).put(updateProfile);

router.route("/suggest-username/:base").get(suggestUsername);
router.route("/search-username/:keyword").get(searchUsername);

export default router;
