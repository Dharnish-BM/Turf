import jwt from "jsonwebtoken";
import { Auction } from "../models/Auction.js";
import { Match } from "../models/Match.js";

const MIN_BID = 5000;

function getRoom(matchId) {
  return `match:${matchId}`;
}

async function isMatchCaptain(matchId, userId) {
  const match = await Match.findById(matchId).select("teams.teamA.captain teams.teamB.captain");
  if (!match) return false;
  return (
    String(match.teams.teamA.captain) === String(userId) ||
    String(match.teams.teamB.captain) === String(userId)
  );
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

    socket.on("match:join", async ({ matchId }) => {
      socket.join(getRoom(matchId));
      await emitState(io, matchId);
    });

    socket.on("auction:start", async ({ matchId }) => {
      if (socket.user.role !== "admin") {
        io.to(getRoom(matchId)).emit("auction:error", "Only admin can start the auction");
        return;
      }
      const auction = await Auction.findOne({ matchId });
      if (!auction) {
        io.to(getRoom(matchId)).emit("auction:error", "Auction document not found for this match");
        return;
      }
      if (auction.status === "running") {
        io.to(getRoom(matchId)).emit("auction:error", "Auction already running");
        return;
      }
      if (auction.status === "completed") {
        io.to(getRoom(matchId)).emit("auction:error", "Auction already completed");
        return;
      }
      if (!auction.playerQueue?.length) {
        io.to(getRoom(matchId)).emit("auction:error", "No players in auction queue for this match");
        return;
      }
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
      if (!auction.currentPlayer) return;
      if (!socket.user.isCaptain) return;
      const allowedCaptain = await isMatchCaptain(matchId, socket.user.id);
      if (!allowedCaptain) {
        io.to(getRoom(matchId)).emit("auction:error", "Only captains of this match can bid");
        return;
      }
      if (!Number.isFinite(amount) || amount < MIN_BID) {
        io.to(getRoom(matchId)).emit("auction:error", `Bid must be at least ${MIN_BID}`);
        return;
      }
      const captainBudget = auction.budgets.get(socket.user.id) || 0;
      const highest = auction.bids.reduce((acc, bid) => Math.max(acc, bid.amount), 0);
      if (amount <= highest) {
        io.to(getRoom(matchId)).emit("auction:error", "Bid must be higher than current highest");
        return;
      }
      if (amount > captainBudget) {
        io.to(getRoom(matchId)).emit("auction:error", "Bid exceeds captain budget");
        return;
      }
      auction.bids.push({ captain: socket.user.id, amount });
      await auction.save();
      io.to(getRoom(matchId)).emit("bid:placed", { captain: socket.user.id, amount });
      await emitState(io, matchId);
    });

    socket.on("player:sold", async ({ matchId }) => {
      if (socket.user.role !== "admin") {
        io.to(getRoom(matchId)).emit("auction:error", "Only admin can sell a player");
        return;
      }
      const auction = await Auction.findOne({ matchId });
      if (!auction) {
        io.to(getRoom(matchId)).emit("auction:error", "Auction document not found for this match");
        return;
      }
      if (!auction.currentPlayer) {
        io.to(getRoom(matchId)).emit("auction:error", "No current player to sell");
        return;
      }
      const winningBid = auction.bids.reduce((best, bid) => (bid.amount > (best?.amount || 0) ? bid : best), null);

      if (winningBid) {
        const remaining = (auction.budgets.get(String(winningBid.captain)) || 0) - winningBid.amount;
        auction.budgets.set(String(winningBid.captain), remaining);
        auction.soldPlayers.push({
          player: auction.currentPlayer,
          captain: winningBid.captain,
          amount: winningBid.amount
        });

        const match = await Match.findById(matchId);
        if (match) {
          const winningCaptain = String(winningBid.captain);
          if (String(match.teams.teamA.captain) === winningCaptain) {
            const nextPlayers = new Set(match.teams.teamA.players.map(String));
            nextPlayers.add(String(auction.currentPlayer));
            match.teams.teamA.players = [...nextPlayers];
          } else if (String(match.teams.teamB.captain) === winningCaptain) {
            const nextPlayers = new Set(match.teams.teamB.players.map(String));
            nextPlayers.add(String(auction.currentPlayer));
            match.teams.teamB.players = [...nextPlayers];
          }
          await match.save();
        }
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
