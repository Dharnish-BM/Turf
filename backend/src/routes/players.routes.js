import express from "express";
import { User } from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth(), async (_, res) => {
  const players = await User.find({ role: "player" }).select("-password").sort({ name: 1 });
  return res.json(players);
});

router.post("/", auth(["admin"]), async (req, res) => {
  const player = await User.create({ ...req.body, role: "player" });
  return res.status(201).json({ ...player.toObject(), password: undefined });
});

router.put("/:id", auth(["admin"]), async (req, res) => {
  const payload = { ...req.body };
  delete payload.password;
  const player = await User.findByIdAndUpdate(req.params.id, payload, { new: true }).select("-password");
  return res.json(player);
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  return res.status(204).send();
});

export default router;
