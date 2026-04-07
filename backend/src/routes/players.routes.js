import express from "express";
import { User } from "../models/User.js";
import { Match } from "../models/Match.js";
import { Scorecard } from "../models/Scorecard.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth(), async (_, res) => {
  const players = await User.find({ role: "player" }).select("-password").sort({ name: 1 });
  return res.json(players);
});

function isLegalBatBall(extraType) {
  return ["none", "bye", "leg-bye"].includes(extraType || "none");
}

function isLegalBowlBall(extraType) {
  return ["none", "bye", "leg-bye"].includes(extraType || "none");
}

router.get("/:id/stats", auth(), async (req, res) => {
  const playerId = String(req.params.id);
  const player = await User.findById(playerId).select("name email isCaptain role");
  if (!player) {
    return res.status(404).json({ message: "Player not found" });
  }

  const matches = await Match.find({ players: playerId })
    .select("name mode format overs teams toss status createdAt updatedAt")
    .sort({ createdAt: -1 })
    .lean();

  const matchIds = matches.map((m) => String(m._id));
  const scorecards = await Scorecard.find({ matchId: { $in: matchIds } }).lean();
  const scorecardMap = new Map(scorecards.map((s) => [String(s.matchId), s]));

  const career = {
    matches: matches.length,
    batting: { innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0, sr: 0, best: 0 },
    bowling: { innings: 0, wickets: 0, runs: 0, balls: 0, economy: 0, bestW: 0, bestRuns: 0 },
    fielding: { catches: 0, runOuts: 0 }
  };

  const history = [];

  for (const m of matches) {
    const sc = scorecardMap.get(String(m._id));
    const batting = { runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0, sr: 0, bestInnings: 0, innings: 0 };
    const bowling = { balls: 0, runs: 0, wickets: 0, economy: 0, innings: 0, bestW: 0, bestRuns: 0 };

    // Per-innings rollups
    for (const inn of sc?.innings || []) {
      let batRunsInn = 0;
      let batBallsInn = 0;
      let batFoursInn = 0;
      let batSixesInn = 0;
      let outInn = 0;

      let bowlRunsInn = 0;
      let bowlBallsInn = 0;
      let bowlWktsInn = 0;

      for (const b of inn.balls || []) {
        const exType = b.extras?.type || "none";
        const batId = String(b.batsman);
        const bowlId = String(b.bowler);

        if (batId === playerId && isLegalBatBall(exType)) {
          const r = Number(b.runs || 0);
          batRunsInn += r;
          batBallsInn += 1;
          if (r === 4) batFoursInn += 1;
          if (r === 6) batSixesInn += 1;
        }

        if (b.wicket?.isWicket && b.wicket?.playerOut && String(b.wicket.playerOut) === playerId) {
          outInn += 1;
        }

        if (bowlId === playerId) {
          const r = Number(b.runs || 0) + Number(b.extras?.runs || 0);
          bowlRunsInn += r;
          if (b.wicket?.isWicket) bowlWktsInn += 1;
          if (isLegalBowlBall(exType)) bowlBallsInn += 1;
        }
      }

      if (batBallsInn > 0) {
        batting.innings += 1;
        batting.runs += batRunsInn;
        batting.balls += batBallsInn;
        batting.fours += batFoursInn;
        batting.sixes += batSixesInn;
        batting.outs += outInn;
        batting.bestInnings = Math.max(batting.bestInnings, batRunsInn);
      }

      if (bowlBallsInn > 0 || bowlRunsInn > 0 || bowlWktsInn > 0) {
        bowling.innings += 1;
        bowling.runs += bowlRunsInn;
        bowling.balls += bowlBallsInn;
        bowling.wickets += bowlWktsInn;
        if (bowlWktsInn > bowling.bestW || (bowlWktsInn === bowling.bestW && bowlRunsInn < bowling.bestRuns)) {
          bowling.bestW = bowlWktsInn;
          bowling.bestRuns = bowlRunsInn;
        }
      }
    }

    batting.sr = batting.balls ? (batting.runs / batting.balls) * 100 : 0;
    bowling.economy = bowling.balls ? (bowling.runs / bowling.balls) * 6 : 0;

    career.batting.innings += batting.innings;
    career.batting.runs += batting.runs;
    career.batting.balls += batting.balls;
    career.batting.fours += batting.fours;
    career.batting.sixes += batting.sixes;
    career.batting.outs += batting.outs;
    career.batting.best = Math.max(career.batting.best, batting.bestInnings);

    career.bowling.innings += bowling.innings;
    career.bowling.runs += bowling.runs;
    career.bowling.balls += bowling.balls;
    career.bowling.wickets += bowling.wickets;
    if (bowling.bestW > career.bowling.bestW || (bowling.bestW === career.bowling.bestW && bowling.bestRuns < career.bowling.bestRuns)) {
      career.bowling.bestW = bowling.bestW;
      career.bowling.bestRuns = bowling.bestRuns;
    }

    history.push({
      matchId: String(m._id),
      matchName: m.name,
      createdAt: m.createdAt,
      status: m.status,
      battingTeamA: m.teams?.teamA?.name,
      battingTeamB: m.teams?.teamB?.name,
      batting,
      bowling
    });
  }

  career.batting.sr = career.batting.balls ? (career.batting.runs / career.batting.balls) * 100 : 0;
  career.bowling.economy = career.bowling.balls ? (career.bowling.runs / career.bowling.balls) * 6 : 0;

  return res.json({
    player: { _id: String(player._id), name: player.name, email: player.email, isCaptain: player.isCaptain },
    career,
    history
  });
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
