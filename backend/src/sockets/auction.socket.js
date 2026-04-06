import jwt from "jsonwebtoken";
import { Auction } from "../models/Auction.js";
import { Match } from "../models/Match.js";

const MIN_BID = 5000;

function getRoom(matchId) {
  return `match:${matchId}`;
}

async function emitState(io, matchId) {
  const auction = await Auction.findOne({ matchId }).populate("currentPlayer", "name").populate("bids.captain", "name");
  io.to(getRoom(matchId)).emit("bid:update", auction);
}

export function setupAuctionSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("auction:join", async ({ matchId }) => {
      socket.join(getRoom(matchId));
      await emitState(io, matchId);
    });

    socket.on("auction:start", async ({ matchId }) => {
      if (socket.user.role !== "admin") return;
      const auction = await Auction.findOne({ matchId });
      if (!auction) return;
      auction.status = "running";
      auction.currentPlayer = auction.playerQueue[0] || null;
      await auction.save();
      await Match.findByIdAndUpdate(matchId, { status: "auction_live" });
      io.to(getRoom(matchId)).emit("auction:start", auction);
      io.to(getRoom(matchId)).emit("player:next", { currentPlayer: auction.currentPlayer });
      await emitState(io, matchId);
    });

    socket.on("bid:placed", async ({ matchId, amount }) => {
      const auction = await Auction.findOne({ matchId });
      if (!auction || auction.status !== "running") return;
      if (!socket.user.isCaptain) return;
      if (amount < MIN_BID) return;
      const captainBudget = auction.budgets.get(socket.user.id) || 0;
      const highest = auction.bids.reduce((acc, bid) => Math.max(acc, bid.amount), 0);
      if (amount <= highest || amount > captainBudget) return;
      auction.bids.push({ captain: socket.user.id, amount });
      await auction.save();
      io.to(getRoom(matchId)).emit("bid:placed", { captain: socket.user.id, amount });
      await emitState(io, matchId);
    });

    socket.on("player:sold", async ({ matchId }) => {
      if (socket.user.role !== "admin") return;
      const auction = await Auction.findOne({ matchId });
      if (!auction || !auction.currentPlayer) return;
      const winningBid = auction.bids.reduce((best, bid) => (bid.amount > (best?.amount || 0) ? bid : best), null);

      if (winningBid) {
        const remaining = (auction.budgets.get(String(winningBid.captain)) || 0) - winningBid.amount;
        auction.budgets.set(String(winningBid.captain), remaining);
        auction.soldPlayers.push({
          player: auction.currentPlayer,
          captain: winningBid.captain,
          amount: winningBid.amount
        });
      }

      auction.playerQueue = auction.playerQueue.filter((p) => String(p) !== String(auction.currentPlayer));
      auction.currentPlayer = auction.playerQueue[0] || null;
      auction.bids = [];
      if (!auction.currentPlayer) {
        auction.status = "completed";
        await Match.findByIdAndUpdate(matchId, { status: "ready" });
      }
      await auction.save();
      io.to(getRoom(matchId)).emit("player:sold", winningBid || null);
      io.to(getRoom(matchId)).emit("player:next", { currentPlayer: auction.currentPlayer });
      await emitState(io, matchId);
    });
  });
}
