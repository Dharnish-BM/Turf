import express from "express";
import { Match } from "../models/Match.js";
import { Auction } from "../models/Auction.js";
import { Scorecard } from "../models/Scorecard.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

function isLegalBall(extraType) {
  return !["wide", "no-ball"].includes(extraType || "none");
}

function rotateStrike(innings) {
  const tmp = innings.striker;
  innings.striker = innings.nonStriker;
  innings.nonStriker = tmp;
}

function battingTeamFromToss(match) {
  const { winner, decision } = match.toss || {};
  if (!winner || !decision) return null;
  if (decision === "bat") return winner;
  return winner === "teamA" ? "teamB" : "teamA";
}

function bowlingTeamFor(battingTeam) {
  return battingTeam === "teamA" ? "teamB" : "teamA";
}

router.get("/", auth(), async (_, res) => {
  const matches = await Match.find()
    .populate("players", "name email isCaptain")
    .populate("teams.teamA.captain", "name")
    .populate("teams.teamB.captain", "name")
    .sort({ createdAt: -1 });
  return res.json(matches);
});

router.post("/", auth(["admin"]), async (req, res) => {
  const match = await Match.create(req.body);
  await Scorecard.create({ matchId: match._id, innings: [] });
  if (match.mode === "auction") {
    await Auction.create({
      matchId: match._id,
      playerQueue: match.players,
      budgets: {
        [String(match.teams.teamA.captain)]: 100000,
        [String(match.teams.teamB.captain)]: 100000
      }
    });
  }
  return res.status(201).json(match);
});

router.post("/:id/toss", auth(["admin"]), async (req, res) => {
  const { winner, decision } = req.body;
  const match = await Match.findByIdAndUpdate(
    req.params.id,
    { toss: { winner, decision }, status: "ready" },
    { new: true }
  );
  return res.json(match);
});

router.post("/:id/innings/start", auth(["admin"]), async (req, res) => {
  const { openingBatsmanA, openingBatsmanB, bowler } = req.body;
  const match = await Match.findById(req.params.id);
  const scorecard = await Scorecard.findOne({ matchId: req.params.id });
  if (!match || !scorecard) {
    return res.status(404).json({ message: "Match/scorecard not found" });
  }

  let battingTeam;
  let bowlingTeam;
  let target = 0;

  if (scorecard.innings.length === 0) {
    battingTeam = battingTeamFromToss(match);
    if (!battingTeam) {
      return res.status(400).json({ message: "Set toss before starting innings" });
    }
    bowlingTeam = bowlingTeamFor(battingTeam);
  } else if (scorecard.innings.length === 1 && scorecard.innings[0].isComplete) {
    battingTeam = scorecard.innings[0].bowlingTeam;
    bowlingTeam = scorecard.innings[0].battingTeam;
    target = scorecard.innings[0].totalRuns + 1;
  } else {
    return res.status(400).json({ message: "Current innings already active" });
  }

  scorecard.innings.push({
    battingTeam,
    bowlingTeam,
    totalRuns: 0,
    wickets: 0,
    ballsFaced: 0,
    striker: openingBatsmanA,
    nonStriker: openingBatsmanB,
    currentBowler: bowler,
    target,
    isComplete: false,
    nextBatsmanRequired: false,
    balls: []
  });
  scorecard.currentInnings = scorecard.innings.length - 1;
  await scorecard.save();
  await Match.findByIdAndUpdate(req.params.id, { status: "live" });

  return res.json(scorecard);
});

router.post("/:id/score", auth(["admin"]), async (req, res) => {
  const { runs = 0, extras = { type: "none", runs: 0 }, wicket, nextBatsman, bowler } = req.body;
  const scorecard = await Scorecard.findOne({ matchId: req.params.id });
  const match = await Match.findById(req.params.id);
  if (!scorecard || !match) {
    return res.status(404).json({ message: "Match/scorecard not found" });
  }
  const innings = scorecard.innings[scorecard.currentInnings];
  if (!innings || innings.isComplete) {
    return res.status(400).json({ message: "No active innings. Start innings first." });
  }
  if (!innings.striker || !innings.nonStriker || !innings.currentBowler) {
    return res.status(400).json({ message: "Innings is missing striker/non-striker/bowler" });
  }
  if (innings.nextBatsmanRequired && !nextBatsman) {
    return res.status(400).json({ message: "Select next batsman after wicket" });
  }
  if (bowler) {
    innings.currentBowler = bowler;
  }

  const legal = isLegalBall(extras.type);
  const extraRuns = Number(extras.runs || 0);
  const batRuns = Number(runs || 0);
  const totalOnBall = batRuns + extraRuns;

  if (legal) {
    innings.ballsFaced += 1;
  }
  innings.totalRuns += totalOnBall;

  const over = Math.floor(innings.ballsFaced / 6);
  const ball = (innings.ballsFaced % 6) || 6;

  innings.balls.push({
    batsman: innings.striker,
    bowler: innings.currentBowler,
    runs: batRuns,
    extras: { type: extras.type || "none", runs: extraRuns },
    wicket: wicket || { isWicket: false, type: "", playerOut: null },
    over: legal ? over : Math.floor((innings.ballsFaced + 1) / 6),
    ball
  });

  if (wicket?.isWicket) {
    innings.wickets += 1;
    const outPlayer = wicket.playerOut ? String(wicket.playerOut) : String(innings.striker);
    if (String(innings.striker) === outPlayer) {
      innings.striker = nextBatsman || null;
    } else if (String(innings.nonStriker) === outPlayer) {
      innings.nonStriker = nextBatsman || innings.nonStriker;
    } else {
      innings.striker = nextBatsman || innings.striker;
    }
    innings.nextBatsmanRequired = !nextBatsman;
  } else {
    innings.nextBatsmanRequired = false;
    if (totalOnBall % 2 === 1) {
      rotateStrike(innings);
    }
  }

  const endOfOver = legal && innings.ballsFaced > 0 && innings.ballsFaced % 6 === 0;
  if (endOfOver) {
    rotateStrike(innings);
  }

  const allOut = innings.wickets >= 10;
  const oversComplete = innings.ballsFaced >= (match.overs || 10) * 6;
  const chaseDone = innings.target > 0 && innings.totalRuns >= innings.target;
  if (allOut || oversComplete || chaseDone) {
    innings.isComplete = true;
    innings.nextBatsmanRequired = false;
    if (scorecard.innings.length === 1) {
      scorecard.currentInnings = 1;
    } else {
      await Match.findByIdAndUpdate(req.params.id, { status: "completed" });
      const first = scorecard.innings[0].totalRuns;
      const second = scorecard.innings[1].totalRuns;
      scorecard.winner = first === second ? "draw" : second > first ? scorecard.innings[1].battingTeam : scorecard.innings[0].battingTeam;
    }
  }

  await scorecard.save();
  return res.json(scorecard);
});

router.get("/:id/scorecard", auth(), async (req, res) => {
  const scorecard = await Scorecard.findOne({ matchId: req.params.id })
    .populate("innings.balls.batsman", "name")
    .populate("innings.balls.bowler", "name")
    .populate("innings.striker", "name")
    .populate("innings.nonStriker", "name")
    .populate("innings.currentBowler", "name");
  return res.json(scorecard);
});

export default router;
