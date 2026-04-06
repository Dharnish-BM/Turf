import express from "express";
import { Match } from "../models/Match.js";
import { Auction } from "../models/Auction.js";
import { Scorecard } from "../models/Scorecard.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();
const roomForMatch = (matchId) => `match:${matchId}`;

async function fetchPopulatedScorecard(matchId) {
  return Scorecard.findOne({ matchId })
    .populate("innings.balls.batsman", "name")
    .populate("innings.balls.bowler", "name")
    .populate("innings.striker", "name")
    .populate("innings.nonStriker", "name")
    .populate("innings.currentBowler", "name");
}

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

function hasPlayer(team, playerId) {
  return team.players.some((id) => String(id) === String(playerId));
}

function legalBallCountFromInnings(innings) {
  return innings.balls.filter((ball) => isLegalBall(ball.extras?.type)).length;
}

function validateWicketPayload(wicket) {
  if (!wicket?.isWicket) return null;
  const allowed = new Set(["bowled", "caught", "lbw", "run-out", "stumped", "hit-wicket", "retired-out"]);
  if (!wicket.type || !allowed.has(wicket.type)) {
    return "Invalid wicket type";
  }
  if (!wicket.playerOut) {
    return "playerOut is required when wicket is true";
  }
  return null;
}

router.get("/", auth(), async (_, res) => {
  const matches = await Match.find()
    .populate("players", "name email isCaptain")
    .populate("teams.teamA.captain", "name")
    .populate("teams.teamB.captain", "name")
    .populate("teams.teamA.players", "name")
    .populate("teams.teamB.players", "name")
    .sort({ createdAt: -1 });
  return res.json(matches);
});

router.post("/", auth(["admin"]), async (req, res) => {
  const body = req.body;
  const teamAPlayers = new Set((body.teams?.teamA?.players || []).map(String));
  const teamBPlayers = new Set((body.teams?.teamB?.players || []).map(String));
  if (body.teams?.teamA?.captain) teamAPlayers.add(String(body.teams.teamA.captain));
  if (body.teams?.teamB?.captain) teamBPlayers.add(String(body.teams.teamB.captain));

  if (body.mode === "manual" && teamAPlayers.size <= 1 && teamBPlayers.size <= 1) {
    const allPlayers = (body.players || []).map(String);
    let turn = 0;
    for (const playerId of allPlayers) {
      if (teamAPlayers.has(playerId) || teamBPlayers.has(playerId)) continue;
      if (turn % 2 === 0) teamAPlayers.add(playerId);
      else teamBPlayers.add(playerId);
      turn += 1;
    }
  }

  const payload = {
    ...body,
    teams: {
      ...body.teams,
      teamA: { ...body.teams.teamA, players: [...teamAPlayers] },
      teamB: { ...body.teams.teamB, players: [...teamBPlayers] }
    }
  };
  const match = await Match.create(payload);
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

  const battingTeamState = match.teams[battingTeam];
  const bowlingTeamState = match.teams[bowlingTeam];
  if (!hasPlayer(battingTeamState, openingBatsmanA) || !hasPlayer(battingTeamState, openingBatsmanB)) {
    return res.status(400).json({ message: "Opening batsmen must belong to batting team" });
  }
  if (!hasPlayer(bowlingTeamState, bowler)) {
    return res.status(400).json({ message: "Opening bowler must belong to bowling team" });
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
  const populatedScorecard = await fetchPopulatedScorecard(req.params.id);
  req.app.get("io")?.to(roomForMatch(req.params.id)).emit("innings:start", {
    matchId: req.params.id,
    scorecard: populatedScorecard
  });
  req.app.get("io")?.to(roomForMatch(req.params.id)).emit("score:update", {
    matchId: req.params.id,
    scorecard: populatedScorecard
  });

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
  const wicketError = validateWicketPayload(wicket);
  if (wicketError) {
    return res.status(400).json({ message: wicketError });
  }

  const battingTeam = match.teams[innings.battingTeam];
  const bowlingTeam = match.teams[innings.bowlingTeam];
  if (!battingTeam || !bowlingTeam) {
    return res.status(400).json({ message: "Invalid team state for active innings" });
  }
  if (!hasPlayer(battingTeam, innings.striker) || !hasPlayer(battingTeam, innings.nonStriker)) {
    return res.status(400).json({ message: "Only batting team players can bat" });
  }

  if (!innings.striker || !innings.nonStriker || !innings.currentBowler) {
    return res.status(400).json({ message: "Innings is missing striker/non-striker/bowler" });
  }
  if (innings.nextBatsmanRequired && !nextBatsman) {
    return res.status(400).json({ message: "Select next batsman after wicket" });
  }
  if (bowler) {
    if (!hasPlayer(bowlingTeam, bowler)) {
      return res.status(400).json({ message: "Only bowling team players can bowl" });
    }
    const legalBallsBefore = legalBallCountFromInnings(innings);
    const startOfOver = legalBallsBefore > 0 && legalBallsBefore % 6 === 0;
    if (startOfOver) {
      const previousBall = innings.balls[innings.balls.length - 1];
      if (previousBall && String(previousBall.bowler) === String(bowler) && match.format === "overs") {
        return res.status(400).json({ message: "Bowler cannot bowl consecutive overs in limited overs format" });
      }
    }
    innings.currentBowler = bowler;
  }

  const legal = isLegalBall(extras.type);
  const extraRuns = Number(extras.runs || 0);
  const batRuns = Number(runs || 0);
  const totalOnBall = batRuns + extraRuns;

  if (legal) innings.ballsFaced += 1;
  innings.totalRuns += totalOnBall;

  const legalBallsNow = innings.ballsFaced;
  const over = legalBallsNow > 0 ? Math.floor((legalBallsNow - 1) / 6) : 0;
  const ball = legalBallsNow > 0 ? ((legalBallsNow - 1) % 6) + 1 : 1;

  innings.balls.push({
    batsman: innings.striker,
    bowler: innings.currentBowler,
    runs: batRuns,
    extras: { type: extras.type || "none", runs: extraRuns },
    wicket: wicket || { isWicket: false, type: "", playerOut: null },
    over,
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
    if (nextBatsman && !hasPlayer(battingTeam, nextBatsman)) {
      return res.status(400).json({ message: "Next batsman must belong to batting team" });
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
  const populatedScorecard = await fetchPopulatedScorecard(req.params.id);
  req.app.get("io")?.to(roomForMatch(req.params.id)).emit("score:update", {
    matchId: req.params.id,
    scorecard: populatedScorecard
  });
  if (innings.isComplete) {
    req.app.get("io")?.to(roomForMatch(req.params.id)).emit("innings:complete", {
      matchId: req.params.id,
      scorecard: populatedScorecard
    });
  }
  return res.json(scorecard);
});

router.get("/:id/scorecard", auth(), async (req, res) => {
  const scorecard = await fetchPopulatedScorecard(req.params.id);
  return res.json(scorecard);
});

export default router;
