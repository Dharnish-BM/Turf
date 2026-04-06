import { useApp } from "../context/useApp";

function LeaderboardPanel() {
  const { leaderboard } = useApp();

  return (
    <section className="card grid">
      <h2>Leaderboard</h2>
      <h3>Top 5 Batsmen</h3>
      <ul>
        {leaderboard.topBatsmen.map((b) => (
          <li key={b._id}>
            {b.name} - Runs: {b.runs}, SR: {Number(b.strikeRate).toFixed(2)}
          </li>
        ))}
      </ul>
      <h3>Top 5 Bowlers</h3>
      <ul>
        {leaderboard.topBowlers.map((b) => (
          <li key={b._id}>
            {b.name} - Wickets: {b.wickets}, Eco: {Number(b.economy).toFixed(2)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default LeaderboardPanel;
