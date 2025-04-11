import express from "express";
import {
  createProfile,
  getFriendStatuses,
  getProfile,
  getSearchHistory,
  searchUsername,
  suggestUsername,
  updateProfile,
} from "../controllers/proflie.controller";
import { verifyToken } from "../middlewares/jwt";

const router = express.Router();

router.use(verifyToken);

router.route("/").get(getProfile).post(createProfile).put(updateProfile);

router.route("/online").get(getFriendStatuses);
router.route("/suggest-username/:base").get(suggestUsername);
router.route("/search/:keyword").get(searchUsername);
router.route("/search").get(getSearchHistory);

export default router;
