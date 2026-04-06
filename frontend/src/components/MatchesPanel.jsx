import { api } from "../services/api";
import { useApp } from "../context/useApp";

function MatchesPanel() {
  const { players, captains, matches, bootstrap } = useApp();

  async function createMatch(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.post("/matches", {
      name: form.get("name"),
      players: players.map((p) => p._id),
      mode: form.get("mode"),
      format: "overs",
      overs: Number(form.get("overs") || 10),
      teams: {
        teamA: { name: form.get("teamA"), captain: form.get("captainA"), players: [] },
        teamB: { name: form.get("teamB"), captain: form.get("captainB"), players: [] }
      }
    });
    event.currentTarget.reset();
    await bootstrap();
  }

  async function setToss(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const matchId = form.get("matchId");
    if (!matchId) return;
    await api.post(`/matches/${matchId}/toss`, {
      winner: form.get("winner"),
      decision: form.get("decision")
    });
    await bootstrap();
  }

  return (
    <section className="card grid">
      <h2>Match Management</h2>
      <form className="grid" onSubmit={createMatch}>
        <input name="name" placeholder="Match name" required />
        <input name="teamA" placeholder="Team A name" required />
        <input name="teamB" placeholder="Team B name" required />
        <select name="captainA" required>
          <option value="">Captain A</option>
          {captains.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="captainB" required>
          <option value="">Captain B</option>
          {captains.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="mode" required>
          <option value="manual">Manual</option>
          <option value="auction">Auction</option>
        </select>
        <input type="number" name="overs" min="1" defaultValue="10" />
        <button type="submit">Create Match</button>
      </form>

      <form className="grid" onSubmit={setToss}>
        <h3>Set Toss</h3>
        <select name="matchId" required>
          <option value="">Select match</option>
          {matches.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </select>
        <select name="winner" required>
          <option value="">Toss winner</option>
          <option value="teamA">Team A</option>
          <option value="teamB">Team B</option>
        </select>
        <select name="decision" required>
          <option value="">Decision</option>
          <option value="bat">Bat</option>
          <option value="bowl">Bowl</option>
        </select>
        <button type="submit">Save Toss</button>
      </form>

      <ul>
        {matches.map((m) => (
          <li key={m._id}>
            {m.name} - {m.mode} - {m.status}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MatchesPanel;
