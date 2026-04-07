import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/register-admin", async (req, res) => {
  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    return res.status(400).json({ message: "Admin already exists" });
  }
  const user = await User.create({ ...req.body, role: "admin", isCaptain: false });
  return res.status(201).json({ id: user._id });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const ok = await user.comparePassword(password);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = jwt.sign(
    { id: user._id, role: user.role, isCaptain: user.isCaptain, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  return res.json({ token });
});

router.get("/me", auth(), async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json(user);
});

router.put("/me", auth(), async (req, res) => {
  const { name, avatarUrl } = req.body || {};
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (typeof name === "string" && name.trim()) {
    user.name = name.trim();
  }
  if (typeof avatarUrl === "string") {
    user.avatarUrl = avatarUrl;
  }
  await user.save();
  return res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isCaptain: user.isCaptain,
    avatarUrl: user.avatarUrl
  });
});

router.put("/me/password", auth(), async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: "Provide current password and a new password (min 6 chars)" });
  }
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }
  user.password = String(newPassword);
  await user.save();
  return res.json({ message: "Password updated" });
});

export default router;
