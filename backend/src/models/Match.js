import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    teams: {
      teamA: { type: teamSchema, required: true },
      teamB: { type: teamSchema, required: true }
    },
    mode: { type: String, enum: ["manual", "auction"], required: true },
    format: { type: String, enum: ["overs", "test"], default: "overs" },
    overs: { type: Number, default: 10 },
    toss: {
      winner: { type: String, enum: ["teamA", "teamB", null], default: null },
      decision: { type: String, enum: ["bat", "bowl", null], default: null }
    },
    status: {
      type: String,
      enum: ["draft", "auction_live", "ready", "live", "completed"],
      default: "draft"
    }
  },
  { timestamps: true }
);

export const Match = mongoose.model("Match", matchSchema);
