import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

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

export default router;
