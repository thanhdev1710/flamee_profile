import express from "express";
import {
  createProfile,
  getProfile,
  getSearchHistory,
  isUserOnline,
  searchUsername,
  setUserOnline,
  suggestUsername,
  updateProfile,
} from "../controllers/proflie.controller";
import { verifyToken } from "../middlewares/jwt";

const router = express.Router();

router.use(verifyToken);

router.route("/").get(getProfile).post(createProfile).put(updateProfile);

router.route("/online").post(setUserOnline);
router.route("/online/:userId").get(isUserOnline);

router.route("/suggest-username/:base").get(suggestUsername);
router.route("/search/:keyword").get(searchUsername);
router.route("/search").get(getSearchHistory);

export default router;
