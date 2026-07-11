import { Router } from "express";
import {
  addToHistory,
  getUserHistory,
  login,
  register,
  searchUsers,
  updateProfile,
  googleLogin,
} from "../controllers/user.controller.js";

const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/google-login").post(googleLogin);
router.route("/add_to_activity").post(addToHistory);
router.route("/get_all_activity").get(getUserHistory);
router.route("/search").get(searchUsers);
router.route("/profile").put(updateProfile);

export default router;
