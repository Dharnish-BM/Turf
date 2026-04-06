import { api } from "../services/api";
import { useApp } from "../context/useApp";

function PlayersPanel() {
  const { players, bootstrap } = useApp();

  async function addPlayer(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.post("/players", {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      isCaptain: form.get("isCaptain") === "on"
    });
    event.currentTarget.reset();
    await bootstrap();
  }

  return (
    <section className="card grid">
      <h2>Player Management</h2>
      <form className="grid" onSubmit={addPlayer}>
        <input name="name" placeholder="Player name" required />
        <input name="email" placeholder="Email" required />
        <input name="password" placeholder="Password" type="password" required />
        <label className="inline">
          <input name="isCaptain" type="checkbox" /> Is Captain
        </label>
        <button type="submit">Add Player</button>
      </form>
      <ul>
        {players.map((player) => (
          <li key={player._id}>
            {player.name} ({player.email}) {player.isCaptain ? "- Captain" : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PlayersPanel;
