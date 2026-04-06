import { useState } from "react";
import { useApp } from "./context/useApp";
import LoginView from "./components/LoginView";
import PlayersPanel from "./components/PlayersPanel";
import MatchesPanel from "./components/MatchesPanel";
import AuctionPanel from "./components/AuctionPanel";
import ScoringPanel from "./components/ScoringPanel";
import LeaderboardPanel from "./components/LeaderboardPanel";
import "./index.css";

const tabs = ["Players", "Matches", "Auction", "Scoring", "Leaderboard"];

function App() {
  const { token, matches, selectedMatch, setSelectedMatch, activeMatch, logout } = useApp();
  const [activeTab, setActiveTab] = useState("Players");

  if (!token) {
    return <LoginView />;
  }

  return (
    <main className="container">
      <h1>Mini IPL Turf Manager</h1>
      <div className="inline">
        <div className="tabs">
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <button onClick={logout}>Logout</button>
      </div>

      {(activeTab === "Auction" || activeTab === "Scoring") && (
        <select value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)}>
          <option value="">Select Match</option>
          {matches.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </select>
      )}

      {activeTab === "Players" && <PlayersPanel />}
      {activeTab === "Matches" && <MatchesPanel />}
      {activeTab === "Auction" && <AuctionPanel />}
      {activeTab === "Scoring" && <ScoringPanel />}
      {activeTab === "Leaderboard" && <LeaderboardPanel />}

      <footer className="inline">
        <strong>Active Match:</strong> {activeMatch?.name || "None"}
      </footer>
    </main>
  );
}

export default App;
