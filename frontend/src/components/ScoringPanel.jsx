import { api } from "../services/api";
import { useApp } from "../context/useApp";

function ScoringPanel() {
  const { selectedMatch, players, scorecard, bootstrap, loadScorecard } = useApp();

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

  return (
    <section className="card grid">
      <h2>Ball by Ball Scoring</h2>
      <form className="grid" onSubmit={startInnings}>
        <h3>Start Innings</h3>
        <select name="openingBatsmanA" required>
          <option value="">Opening batsman 1</option>
          {players.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="openingBatsmanB" required>
          <option value="">Opening batsman 2</option>
          {players.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="bowler" required>
          <option value="">Opening bowler</option>
          {players.map((p) => (
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
          {players.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="inline">
          <input name="isWicket" type="checkbox" /> Wicket
        </label>
        <input name="wicketType" placeholder="Wicket type" />
        <select name="playerOut">
          <option value="">Player Out (default striker)</option>
          {players.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="nextBatsman">
          <option value="">Next batsman (if wicket)</option>
          {players.map((p) => (
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
            <li>Innings Complete: {innings.isComplete ? "Yes" : "No"}</li>
          </ul>
        ) : (
          <p>No active innings.</p>
        )}
      </div>
    </section>
  );
}

export default ScoringPanel;
