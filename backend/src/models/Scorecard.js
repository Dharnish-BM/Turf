import mongoose from "mongoose";

const ballSchema = new mongoose.Schema(
  {
    batsman: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bowler: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    runs: { type: Number, default: 0 },
    extras: {
      type: {
        type: String,
        enum: ["none", "wide", "no-ball", "bye", "leg-bye"],
        default: "none"
      },
      runs: { type: Number, default: 0 }
    },
    wicket: {
      isWicket: { type: Boolean, default: false },
      type: { type: String, default: "" },
      playerOut: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
    },
    nextBatsman: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    onStrikeNext: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    over: { type: Number, required: true },
    ball: { type: Number, required: true }
  },
  { _id: false }
);

const scorecardSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", unique: true, required: true },
    currentInnings: { type: Number, default: 0 },
    winner: { type: String, default: "" },
    innings: [
      {
        battingTeam: { type: String, enum: ["teamA", "teamB"], required: true },
        bowlingTeam: { type: String, enum: ["teamA", "teamB"], required: true },
        totalRuns: { type: Number, default: 0 },
        wickets: { type: Number, default: 0 },
        ballsFaced: { type: Number, default: 0 },
        striker: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        nonStriker: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        currentBowler: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        openingStriker: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        openingNonStriker: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        openingBowler: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        target: { type: Number, default: 0 },
        isComplete: { type: Boolean, default: false },
        nextBatsmanRequired: { type: Boolean, default: false },
        balls: [ballSchema]
      }
    ]
  },
  { timestamps: true }
);

export const Scorecard = mongoose.model("Scorecard", scorecardSchema);
