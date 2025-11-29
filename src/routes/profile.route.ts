import express from "express";
import {
  countUsers,
  createProfile,
  dashboard,
  getAllUser,
  getFriendStatuses,
  getProfile,
  getProfileByUsername,
  getSearchHistory,
  recentUserActivities,
  searchUsername,
  suggestUsername,
  updateProfile,
  weeklyUserActivity,
} from "../controllers/proflie.controller";
import { verifyToken } from "../middlewares/jwt";

const router = express.Router();

router.use(verifyToken);

router.route("/dashboard").get(dashboard);
router.route("/count").get(countUsers);
router.route("/weekly").get(weeklyUserActivity);
router.route("/recent").get(recentUserActivities);

router.route("/").get(getProfile).post(createProfile).put(updateProfile);
router.route("/all").get(getAllUser);
router.route("/:username").get(getProfileByUsername);

router.route("/online").get(getFriendStatuses);
router.route("/suggest-username/:base").get(suggestUsername);
router.route("/search/:keyword").get(searchUsername);
router.route("/search").get(getSearchHistory);

export default router;
