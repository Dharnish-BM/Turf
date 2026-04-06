import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDb } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import playerRoutes from "./routes/players.routes.js";
import matchRoutes from "./routes/matches.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import { setupAuctionSocket } from "./sockets/auction.socket.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }
});

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

setupAuctionSocket(io);

const port = process.env.PORT || 5000;
await connectDb(process.env.MONGO_URI);
httpServer.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
