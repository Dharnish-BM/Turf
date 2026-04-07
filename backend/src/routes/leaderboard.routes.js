import express from "express";
import mongoose from "mongoose";
import { Scorecard } from "../models/Scorecard.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth(), async (_, res) => {
  const legalBatTypes = ["none", "bye", "leg-bye"];
  const legalBowlTypes = ["none", "bye", "leg-bye"];

  const batsmen = await Scorecard.aggregate([
    { $unwind: "$innings" },
    { $unwind: "$innings.balls" },
    {
      $group: {
        _id: "$innings.balls.batsman",
        runs: { $sum: "$innings.balls.runs" },
        balls: {
          $sum: {
            $cond: [{ $in: ["$innings.balls.extras.type", legalBatTypes] }, 1, 0]
          }
        },
        matchesSet: { $addToSet: "$matchId" }
      }
    },
    {
      $addFields: {
        matches: { $size: "$matchesSet" },
        strikeRate: {
          $cond: [{ $eq: ["$balls", 0] }, 0, { $multiply: [{ $divide: ["$runs", "$balls"] }, 100] }]
        }
      }
    },
    { $project: { matchesSet: 0 } },
    { $sort: { runs: -1, strikeRate: -1 } },
    { $limit: 5 }
  ]);

  const bowlers = await Scorecard.aggregate([
    { $unwind: "$innings" },
    { $unwind: "$innings.balls" },
    {
      $group: {
        _id: "$innings.balls.bowler",
        wickets: {
          $sum: { $cond: [{ $eq: ["$innings.balls.wicket.isWicket", true] }, 1, 0] }
        },
        runsConceded: { $sum: { $add: ["$innings.balls.runs", "$innings.balls.extras.runs"] } },
        balls: {
          $sum: {
            $cond: [{ $in: ["$innings.balls.extras.type", legalBowlTypes] }, 1, 0]
          }
        },
        matchesSet: { $addToSet: "$matchId" }
      }
    },
    {
      $addFields: {
        matches: { $size: "$matchesSet" },
        economy: {
          $cond: [{ $eq: ["$balls", 0] }, 0, { $multiply: [{ $divide: ["$runsConceded", "$balls"] }, 6] }]
        }
      }
    },
    { $project: { matchesSet: 0 } },
    { $sort: { wickets: -1, economy: 1 } },
    { $limit: 5 }
  ]);

  const ids = [...batsmen, ...bowlers].map((x) => new mongoose.Types.ObjectId(x._id));
  const users = await mongoose.model("User").find({ _id: { $in: ids } }).select("name");
  const nameMap = new Map(users.map((u) => [String(u._id), u.name]));

  return res.json({
    topBatsmen: batsmen.map((b) => ({ ...b, name: nameMap.get(String(b._id)) || "Unknown" })),
    topBowlers: bowlers.map((b) => ({ ...b, name: nameMap.get(String(b._id)) || "Unknown" }))
  });
});

export default router;
