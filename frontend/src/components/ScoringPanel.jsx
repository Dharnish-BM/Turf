import { api } from "../services/api";
import { useApp } from "../context/useApp";

const wicketTypes = ["bowled", "caught", "lbw", "run-out", "stumped", "hit-wicket", "retired-out"];

function toOverString(balls) {
  const overs = Math.floor((balls || 0) / 6);
  const rem = (balls || 0) % 6;
  return `${overs}.${rem}`;
}

function getPartnership(innings) {
  if (!innings) return { runs: 0, balls: 0 };
  const deliveries = innings.balls || [];
  let startIndex = 0;
  for (let i = deliveries.length - 1; i >= 0; i -= 1) {
    if (deliveries[i]?.wicket?.isWicket) {
      startIndex = i + 1;
      break;
    }
  }
  const current = deliveries.slice(startIndex);
  const runs = current.reduce((sum, ball) => sum + Number(ball.runs || 0) + Number(ball.extras?.runs || 0), 0);
  const balls = current.filter((ball) => !["wide", "no-ball"].includes(ball.extras?.type || "none")).length;
  return { runs, balls };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function estimateWinProbability({ isChase, runsRequired, ballsRemaining, wicketsDown, currentRunRate, requiredRunRate }) {
  if (!isChase) return null;
  if (runsRequired <= 0) return 100;
  if (ballsRemaining <= 0) return 0;

  const wicketsInHand = clamp(10 - wicketsDown, 0, 10);
  const rrPressure = requiredRunRate - currentRunRate;

  let probability = 50;
  probability += wicketsInHand * 3.5;
  probability -= rrPressure * 9;
  probability -= runsRequired * 0.35;
  probability += ballsRemaining * 0.12;

  if (ballsRemaining <= 12) {
    probability -= Math.max(rrPressure, 0) * 6;
    probability += wicketsInHand * 1.5;
  }

  return Math.round(clamp(probability, 1, 99));
}

function ScoringPanel() {
  const { selectedMatch, scorecard, activeMatch, bootstrap, loadScorecard } = useApp();

  async function startInnings(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selectedMatch) return;
    await api.post(`/matches/${selectedMatch}/innings/start`, {
      openingBatsmanA: form.get("openingBatsmanA"),
      openingBatsmanB: form.get("openingBatsmanB"),
      bowler: form.get("bowler")
    });
    await loadScorecard(selectedMatch);
    await bootstrap();
  }

  async function submitBall(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selectedMatch) return;
    await api.post(`/matches/${selectedMatch}/score`, {
      runs: Number(form.get("runs") || 0),
      extras: { type: form.get("extraType"), runs: Number(form.get("extraRuns") || 0) },
      wicket: {
        isWicket: form.get("isWicket") === "on",
        type: form.get("wicketType") || "",
        playerOut: form.get("playerOut") || null
      },
      nextBatsman: form.get("nextBatsman") || null,
      bowler: form.get("bowler") || null
    });
    event.currentTarget.reset();
    await loadScorecard(selectedMatch);
    await bootstrap();
  }

  const innings = scorecard?.innings?.[scorecard?.currentInnings] || null;
  const tossWinner = activeMatch?.toss?.winner;
  const tossDecision = activeMatch?.toss?.decision;
  const firstBattingTeam = tossWinner && tossDecision ? (tossDecision === "bat" ? tossWinner : tossWinner === "teamA" ? "teamB" : "teamA") : null;
  const firstBowlingTeam = firstBattingTeam ? (firstBattingTeam === "teamA" ? "teamB" : "teamA") : null;
  const defaultBattingTeam = scorecard?.innings?.length === 0 ? firstBattingTeam : innings?.battingTeam;
  const defaultBowlingTeam = scorecard?.innings?.length === 0 ? firstBowlingTeam : innings?.bowlingTeam;
  const battingPlayers = defaultBattingTeam ? activeMatch?.teams?.[defaultBattingTeam]?.players || [] : [];
  const bowlingPlayers = defaultBowlingTeam ? activeMatch?.teams?.[defaultBowlingTeam]?.players || [] : [];
  const totalBalls = (activeMatch?.overs || 0) * 6;
  const ballsRemaining = innings ? Math.max(totalBalls - innings.ballsFaced, 0) : 0;
  const runsRequired = innings?.target ? Math.max(innings.target - innings.totalRuns, 0) : 0;
  const requiredRunRate = innings?.target && ballsRemaining > 0 ? ((runsRequired * 6) / ballsRemaining).toFixed(2) : "0.00";
  const currentRunRate = innings?.ballsFaced ? ((innings.totalRuns * 6) / innings.ballsFaced).toFixed(2) : "0.00";
  const projectedScore = innings?.ballsFaced
    ? Math.round((innings.totalRuns / innings.ballsFaced) * totalBalls)
    : 0;
  const oversUsed = toOverString(innings?.ballsFaced || 0);
  const partnership = getPartnership(innings);
  const partnershipRate = partnership.balls ? ((partnership.runs * 6) / partnership.balls).toFixed(2) : "0.00";
  const isChase = Boolean(innings?.target);
  const winProbability = estimateWinProbability({
    isChase,
    runsRequired,
    ballsRemaining,
    wicketsDown: innings?.wickets || 0,
    currentRunRate: Number(currentRunRate),
    requiredRunRate: Number(requiredRunRate)
  });

  return (
    <section className="card grid">
      <h2>Ball by Ball Scoring</h2>
      <form className="grid" onSubmit={startInnings}>
        <h3>Start Innings</h3>
        <select name="openingBatsmanA" required>
          <option value="">Opening batsman 1</option>
          {battingPlayers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="openingBatsmanB" required>
          <option value="">Opening batsman 2</option>
          {battingPlayers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="bowler" required>
          <option value="">Opening bowler</option>
          {bowlingPlayers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <button disabled={!selectedMatch} type="submit">
          Start Innings
        </button>
      </form>

      <form className="grid" onSubmit={submitBall}>
        <h3>Add Delivery</h3>
        <input type="number" name="runs" min="0" max="6" defaultValue="0" required />
        <select name="extraType">
          <option value="none">No Extra</option>
          <option value="wide">Wide</option>
          <option value="no-ball">No-ball</option>
          <option value="bye">Bye</option>
          <option value="leg-bye">Leg-bye</option>
        </select>
        <input type="number" name="extraRuns" min="0" defaultValue="0" required />
        <select name="bowler">
          <option value="">Keep current bowler</option>
          {bowlingPlayers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="inline">
          <input name="isWicket" type="checkbox" /> Wicket
        </label>
        <select name="wicketType" defaultValue="">
          <option value="">Dismissal type</option>
          {wicketTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select name="playerOut">
          <option value="">Player Out (default striker)</option>
          {battingPlayers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="nextBatsman">
          <option value="">Next batsman (if wicket)</option>
          {battingPlayers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <button disabled={!selectedMatch} type="submit">
          Add Ball
        </button>
      </form>

      <div className="card">
        <h3>Live Innings State</h3>
        {innings ? (
          <ul>
            <li>Total: {innings.totalRuns}/{innings.wickets}</li>
            <li>Balls: {innings.ballsFaced}</li>
            <li>Striker: {innings.striker?.name || "-"}</li>
            <li>Non-Striker: {innings.nonStriker?.name || "-"}</li>
            <li>Bowler: {innings.currentBowler?.name || "-"}</li>
            <li>Target: {innings.target || "-"}</li>
            <li>Balls Remaining: {ballsRemaining}</li>
            <li>Runs Required: {runsRequired}</li>
            <li>Current RR: {currentRunRate}</li>
            <li>Required RR: {requiredRunRate}</li>
            <li>Innings Complete: {innings.isComplete ? "Yes" : "No"}</li>
          </ul>
        ) : (
          <p>No active innings.</p>
        )}
      </div>

      <div className="card">
        <h3>Scoreboard Summary</h3>
        {innings ? (
          <ul>
            <li>
              Score: {innings.totalRuns}/{innings.wickets} ({oversUsed})
            </li>
            <li>Projected Score ({activeMatch?.overs || 0} overs): {projectedScore}</li>
            <li>Current RR: {currentRunRate}</li>
            <li>
              {isChase ? `Required RR: ${requiredRunRate}` : "Required RR: -"}
            </li>
            <li>
              {isChase ? `Runs Needed: ${runsRequired} off ${ballsRemaining}` : "Runs Needed: -"}
            </li>
            <li>
              Partnership: {partnership.runs} ({toOverString(partnership.balls)} overs, RR {partnershipRate})
            </li>
            <li>{isChase ? `Win Probability (Batting Team): ${winProbability}%` : "Win Probability: Starts in chase innings"}</li>
          </ul>
        ) : (
          <p>Start an innings to view projections and partnerships.</p>
        )}
      </div>
    </section>
  );
}

export default ScoringPanel;
