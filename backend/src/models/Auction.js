import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const auctionSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", unique: true, required: true },
    playerQueue: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    bids: [bidSchema],
    budgets: { type: Map, of: Number, default: {} },
    soldPlayers: [
      {
        player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        captain: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amount: Number
      }
    ],
    status: { type: String, enum: ["pending", "running", "completed"], default: "pending" }
  },
  { timestamps: true }
);

export const Auction = mongoose.model("Auction", auctionSchema);
