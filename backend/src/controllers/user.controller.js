import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt, { hash } from "bcryptjs";
/* const bcrypt = require("bcryptjs"); */

import crypto from "crypto";
import { Meeting } from "../models/meeting.model.js";

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Please Provide" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User Not Found" });
    }

    let isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (isPasswordCorrect) {
      let token = crypto.randomBytes(20).toString("hex");

      user.token = token;
      await user.save();
      return res.status(httpStatus.OK).json({ token: token, name: user.name, username: user.username, uniqueId: user.uniqueId });
    } else {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid Username or password" });
    }
  } catch (e) {
    return res.status(500).json({ message: `Something went wrong ${e}` });
  }
};

const register = async (req, res) => {
  const { name, username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res
        .status(httpStatus.FOUND)
        .json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: name,
      username: username,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(httpStatus.CREATED).json({ message: "User Registered" });
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const getUserHistory = async (req, res) => {
  const { token } = req.query;

  try {
    const user = await User.findOne({ token: token });
    const meetings = await Meeting.find({ user_id: user.username });
    res.json(meetings);
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const addToHistory = async (req, res) => {
  const { token, meeting_code } = req.body;

  try {
    const user = await User.findOne({ token: token });

    const newMeeting = new Meeting({
      user_id: user.username,
      meetingCode: meeting_code,
    });

    await newMeeting.save();

    res.status(httpStatus.CREATED).json({ message: "Added code to history" });
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const searchUsers = async (req, res) => {
  const { q } = req.query;
  const token = req.headers.token || req.query.token;

  if (!token) {
    return res.status(httpStatus.UNAUTHORIZED).json({ message: "No token provided" });
  }

  try {
    const currentUser = await User.findOne({ token });
    if (!currentUser) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }

    if (!q || !q.trim()) {
      return res.json([]);
    }

    // Search by uniqueId, name, or username. Exclude self.
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUser._id } },
        {
          $or: [
            { uniqueId: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },
            { username: { $regex: q, $options: "i" } },
          ],
        },
      ],
    }).select("name username uniqueId");

    res.json(users);
  } catch (e) {
    res.status(500).json({ message: `Error searching users: ${e.message}` });
  }
};

export { login, register, getUserHistory, addToHistory, searchUsers };
