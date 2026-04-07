import express from "express";
import { Match } from "../models/Match.js";
import { Auction } from "../models/Auction.js";
import { Scorecard } from "../models/Scorecard.js";
import { auth } from "../middleware/auth.js";
import { replayInningsState } from "../logic/replayInnings.js";

const router = express.Router();
const roomForMatch = (matchId) => `match:${matchId}`;

async function fetchPopulatedScorecard(matchId) {
  return Scorecard.findOne({ matchId })
    .populate("innings.balls.batsman", "name")
    .populate("innings.balls.bowler", "name")
    .populate("innings.balls.onStrikeNext", "name")
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

function dismissedPlayerIdsForInnings(innings) {
  const out = new Set();
  for (const b of innings.balls || []) {
    const w = b.wicket;
    if (w?.isWicket && w.playerOut) {
      out.add(String(w.playerOut));
    }
  }
  return out;
}

function maxWicketsForBattingTeam(team) {
  const squadSize = team?.players?.length || 0;
  return Math.max(squadSize - 1, 0);
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

router.delete("/", auth(["admin"]), async (_req, res) => {
  await Scorecard.deleteMany({});
  await Auction.deleteMany({});
  await Match.deleteMany({});
  return res.json({ message: "All matches and scorecards cleared (players left intact)" });
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

router.delete("/:id", auth(["admin"]), async (req, res) => {
  const matchId = String(req.params.id);
  const match = await Match.findById(matchId);
  if (!match) {
    return res.status(404).json({ message: "Match not found" });
  }
  if (match.status === "live" || match.status === "completed") {
    return res.status(400).json({ message: "Cannot delete a match that is live or completed" });
  }

  await Scorecard.deleteMany({ matchId });
  await Auction.deleteMany({ matchId });
  await Match.deleteOne({ _id: matchId });

  return res.json({ message: "Match deleted" });
});

router.patch("/:id/setup", auth(["admin"]), async (req, res) => {
  const { format, overs } = req.body || {};
  const match = await Match.findById(req.params.id);
  if (!match) {
    return res.status(404).json({ message: "Match not found" });
  }
  if (match.status === "live" || match.status === "completed") {
    return res.status(400).json({ message: "Cannot change setup while match is live or completed" });
  }
  if (match.toss?.winner) {
    return res.status(400).json({ message: "Cannot change setup after toss is recorded" });
  }

  const fmt = String(format || match.format || "overs");
  if (!["overs", "test"].includes(fmt)) {
    return res.status(400).json({ message: "Invalid format (must be overs or test)" });
  }
  match.format = fmt;
  if (fmt === "overs") {
    const o = Number(overs);
    if (!Number.isFinite(o) || o < 1 || o > 200) {
      return res.status(400).json({ message: "Overs must be between 1 and 200" });
    }
    match.overs = Math.floor(o);
  }

  await match.save();
  const populated = await Match.findById(match._id)
    .populate("players", "name email isCaptain")
    .populate("teams.teamA.captain", "name")
    .populate("teams.teamB.captain", "name")
    .populate("teams.teamA.players", "name email isCaptain")
    .populate("teams.teamB.players", "name email isCaptain");
  return res.json(populated);
});

router.patch("/:id/teams/players", auth(["admin"]), async (req, res) => {
  const { teamAPlayerIds = [], teamBPlayerIds = [] } = req.body;
  const match = await Match.findById(req.params.id);
  if (!match) {
    return res.status(404).json({ message: "Match not found" });
  }
  if (match.status === "live" || match.status === "completed") {
    return res.status(400).json({ message: "Cannot change squads while the match is live or completed" });
  }

  const pool = new Set(match.players.map((id) => String(id)));
  const setA = teamAPlayerIds.map(String);
  const setB = teamBPlayerIds.map(String);
  if (new Set(setA).size !== setA.length || new Set(setB).size !== setB.length) {
    return res.status(400).json({ message: "Duplicate player in a team" });
  }
  const aSet = new Set(setA);
  const bSet = new Set(setB);
  for (const id of aSet) {
    if (bSet.has(id)) {
      return res.status(400).json({ message: "A player cannot be on both teams" });
    }
  }
  for (const id of aSet) {
    if (!pool.has(id)) {
      return res.status(400).json({ message: "Invalid player for this match" });
    }
  }
  for (const id of bSet) {
    if (!pool.has(id)) {
      return res.status(400).json({ message: "Invalid player for this match" });
    }
  }
  const union = new Set([...aSet, ...bSet]);
  if (union.size !== pool.size) {
    return res.status(400).json({ message: "Every player in the match must be assigned to exactly one team" });
  }
  const capA = String(match.teams.teamA.captain);
  const capB = String(match.teams.teamB.captain);
  if (!aSet.has(capA)) {
    return res.status(400).json({ message: "Team A captain must stay on team A" });
  }
  if (!bSet.has(capB)) {
    return res.status(400).json({ message: "Team B captain must stay on team B" });
  }

  match.teams.teamA.players = setA;
  match.teams.teamB.players = setB;
  await match.save();

  const populated = await Match.findById(match._id)
    .populate("players", "name email isCaptain")
    .populate("teams.teamA.captain", "name")
    .populate("teams.teamB.captain", "name")
    .populate("teams.teamA.players", "name email isCaptain")
    .populate("teams.teamB.players", "name email isCaptain");
  return res.json(populated);
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
  if (String(openingBatsmanA) === String(openingBatsmanB)) {
    return res.status(400).json({ message: "Opening batsmen must be two different players" });
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
    openingStriker: openingBatsmanA,
    openingNonStriker: openingBatsmanB,
    openingBowler: bowler,
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
  const { runs = 0, extras = { type: "none", runs: 0 }, wicket, nextBatsman, bowler, strikerAfterWicket } = req.body;
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

  const dismissedBefore = dismissedPlayerIdsForInnings(innings);
  if (wicket?.isWicket && wicket.playerOut && dismissedBefore.has(String(wicket.playerOut))) {
    return res.status(400).json({ message: "That batter is already out in this innings" });
  }
  if (nextBatsman) {
    const nid = String(nextBatsman);
    if (dismissedBefore.has(nid)) {
      return res.status(400).json({ message: "That player is already out and cannot bat again in this innings" });
    }
    if (nid === String(innings.striker) || nid === String(innings.nonStriker)) {
      return res.status(400).json({ message: "Next batsman must be someone not currently at the crease" });
    }
  }
  if (wicket?.isWicket && !nextBatsman) {
    const outId = wicket.playerOut ? String(wicket.playerOut) : String(innings.striker);
    const remainingEligible = battingTeam.players.filter((pid) => {
      const id = String(pid);
      if (dismissedBefore.has(id)) return false;
      if (id === outId) return false;
      if (id === String(innings.striker)) return false;
      if (id === String(innings.nonStriker)) return false;
      return true;
    });
    if (remainingEligible.length > 0) {
      return res.status(400).json({ message: "Select next batsman after wicket" });
    }
  }

  const legalBeforeAdd = legalBallCountFromInnings(innings);
  const isFirstDeliveryOfNewOver = legalBeforeAdd > 0 && legalBeforeAdd % 6 === 0;

  if (isFirstDeliveryOfNewOver && match.format === "overs") {
    if (!bowler) {
      return res.status(400).json({
        message:
          "A new over has started: choose the bowler in the UI before this ball (including wides and no-balls). The previous bowler cannot be assumed."
      });
    }
    if (!hasPlayer(bowlingTeam, bowler)) {
      return res.status(400).json({ message: "Only bowling team players can bowl" });
    }
    const lastLegalBall = [...innings.balls].reverse().find((b) => isLegalBall(b.extras?.type));
    if (lastLegalBall && String(lastLegalBall.bowler) === String(bowler)) {
      return res.status(400).json({ message: "Bowler cannot bowl consecutive overs in limited overs format" });
    }
    innings.currentBowler = bowler;
  } else if (isFirstDeliveryOfNewOver && bowler) {
    if (!hasPlayer(bowlingTeam, bowler)) {
      return res.status(400).json({ message: "Only bowling team players can bowl" });
    }
    innings.currentBowler = bowler;
  } else if (bowler) {
    if (!hasPlayer(bowlingTeam, bowler)) {
      return res.status(400).json({ message: "Only bowling team players can bowl" });
    }
    innings.currentBowler = bowler;
  }

  const legal = isLegalBall(extras.type);
  const extraRuns = Number(extras.runs || 0);
  const batRuns = Number(runs || 0);
  if (wicket?.isWicket && (batRuns < 0 || batRuns > 6 || !Number.isFinite(batRuns))) {
    return res.status(400).json({ message: "Runs scored off the bat on this ball must be between 0 and 6" });
  }
  const totalOnBall = batRuns + extraRuns;

  if (legal) innings.ballsFaced += 1;
  innings.totalRuns += totalOnBall;

  let over;
  let ball;
  if (legal) {
    const legalBallsNow = innings.ballsFaced;
    over = legalBallsNow > 0 ? Math.floor((legalBallsNow - 1) / 6) : 0;
    ball = legalBallsNow > 0 ? ((legalBallsNow - 1) % 6) + 1 : 1;
  } else if (legalBeforeAdd > 0 && legalBeforeAdd % 6 === 0) {
    over = legalBeforeAdd / 6;
    ball = 0;
  } else if (legalBeforeAdd > 0) {
    over = Math.floor((legalBeforeAdd - 1) / 6);
    ball = 0;
  } else {
    over = 0;
    ball = 0;
  }

  let onStrikeNext = null;
  if (wicket?.isWicket && wicket?.type === "run-out" && nextBatsman && strikerAfterWicket) {
    const outPlayer = wicket.playerOut ? String(wicket.playerOut) : String(innings.striker);
    const incomingId = String(nextBatsman);
    let survivorId = null;
    if (String(innings.striker) === outPlayer) {
      survivorId = String(innings.nonStriker);
    } else if (String(innings.nonStriker) === outPlayer) {
      survivorId = String(innings.striker);
    }
    if (!survivorId) {
      return res.status(400).json({ message: "Run out: dismissed batter must be striker or non-striker" });
    }
    const sid = String(strikerAfterWicket);
    if (sid !== incomingId && sid !== survivorId) {
      return res.status(400).json({
        message: "On strike must be the new batter or the not-out partner"
      });
    }
    onStrikeNext = strikerAfterWicket;
  }

  innings.balls.push({
    batsman: innings.striker,
    bowler: innings.currentBowler,
    runs: batRuns,
    extras: { type: extras.type || "none", runs: extraRuns },
    wicket: wicket || { isWicket: false, type: "", playerOut: null },
    nextBatsman: wicket?.isWicket ? nextBatsman || null : null,
    onStrikeNext: onStrikeNext || null,
    over,
    ball
  });

  if (wicket?.isWicket) {
    innings.wickets += 1;
    const outPlayer = wicket.playerOut ? String(wicket.playerOut) : String(innings.striker);
    if (wicket.type === "run-out" && nextBatsman && onStrikeNext) {
      const incomingId = String(nextBatsman);
      let survivorId;
      if (String(innings.striker) === outPlayer) {
        survivorId = String(innings.nonStriker);
      } else if (String(innings.nonStriker) === outPlayer) {
        survivorId = String(innings.striker);
      } else {
        return res.status(400).json({ message: "Invalid run-out state" });
      }
      const strikeId = String(onStrikeNext);
      if (strikeId === incomingId) {
        innings.striker = nextBatsman;
        innings.nonStriker = survivorId;
      } else {
        innings.striker = survivorId;
        innings.nonStriker = nextBatsman;
      }
    } else if (String(innings.striker) === outPlayer) {
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

  const allOut = innings.wickets >= maxWicketsForBattingTeam(battingTeam);
  const oversComplete = match.format === "overs" ? innings.ballsFaced >= (match.overs || 10) * 6 : false;
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

function getUndoInningsIndex(scorecard) {
  const arr = scorecard.innings;
  if (!arr?.length) return -1;
  if (arr[arr.length - 1].balls?.length > 0) return arr.length - 1;
  if (arr.length >= 2 && arr[arr.length - 2].balls?.length > 0) return arr.length - 2;
  return -1;
}

router.delete("/:id/score/last", auth(["admin"]), async (req, res) => {
  const scorecard = await Scorecard.findOne({ matchId: req.params.id });
  const match = await Match.findById(req.params.id);
  if (!scorecard || !match) {
    return res.status(404).json({ message: "Match/scorecard not found" });
  }
  const idx = getUndoInningsIndex(scorecard);
  if (idx < 0) {
    return res.status(400).json({ message: "Nothing to undo" });
  }
  const inn = scorecard.innings[idx];
  if (!inn.balls?.length) {
    return res.status(400).json({ message: "Nothing to undo" });
  }
  if (!inn.openingStriker || !inn.openingNonStriker || !inn.openingBowler) {
    return res.status(400).json({
      message: "Undo unavailable for this innings (started before undo support). Start a new match or innings."
    });
  }

  inn.balls.pop();
  const replayed = replayInningsState(
    match,
    {
      battingTeam: inn.battingTeam,
      target: inn.target,
      openingStriker: inn.openingStriker,
      openingNonStriker: inn.openingNonStriker,
      openingBowler: inn.openingBowler
    },
    inn.balls
  );
  inn.totalRuns = replayed.totalRuns;
  inn.ballsFaced = replayed.ballsFaced;
  inn.wickets = replayed.wickets;
  inn.striker = replayed.striker;
  inn.nonStriker = replayed.nonStriker;
  inn.currentBowler = replayed.currentBowler;
  inn.nextBatsmanRequired = replayed.nextBatsmanRequired;
  inn.isComplete = replayed.isComplete;

  if (scorecard.winner) {
    scorecard.winner = "";
    await Match.findByIdAndUpdate(req.params.id, { status: "live" });
  }
  if (idx === 0 && !inn.isComplete && scorecard.innings.length === 1 && scorecard.currentInnings !== 0) {
    scorecard.currentInnings = 0;
  }

  await scorecard.save();
  const populatedScorecard = await fetchPopulatedScorecard(req.params.id);
  req.app.get("io")?.to(roomForMatch(req.params.id)).emit("score:update", {
    matchId: req.params.id,
    scorecard: populatedScorecard
  });
  return res.json(populatedScorecard);
});

router.get("/:id/scorecard", auth(), async (req, res) => {
  const scorecard = await fetchPopulatedScorecard(req.params.id);
  return res.json(scorecard);
});

router.get("/:id", auth(), async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate("players", "name email isCaptain")
    .populate("teams.teamA.captain", "name")
    .populate("teams.teamB.captain", "name")
    .populate("teams.teamA.players", "name email isCaptain")
    .populate("teams.teamB.players", "name email isCaptain");
  if (!match) {
    return res.status(404).json({ message: "Match not found" });
  }
  return res.json(match);
});

export default router;
