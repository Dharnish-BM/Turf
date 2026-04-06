import { useCallback, useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../services/api";
import { getAuctionSocket } from "../services/socket";
import { parseJwt } from "../utils/auth";
import { AppContext } from "./AppContextObject";

export function AppProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(parseJwt(localStorage.getItem("token") || ""));
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [leaderboard, setLeaderboard] = useState({ topBatsmen: [], topBowlers: [] });
  const [selectedMatch, setSelectedMatch] = useState("");
  const [auctionState, setAuctionState] = useState(null);
  const [scorecard, setScorecard] = useState(null);

  useEffect(() => {
    setAuthToken(token);
    setUser(parseJwt(token));
  }, [token]);

  const bootstrap = useCallback(async () => {
    const [playersRes, matchesRes, leaderboardRes] = await Promise.all([
      api.get("/players"),
      api.get("/matches"),
      api.get("/leaderboard")
    ]);
    setPlayers(playersRes.data);
    setMatches(matchesRes.data);
    setLeaderboard(leaderboardRes.data);
  }, []);

  async function login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    const authToken = response.data.token;
    localStorage.setItem("token", authToken);
    setToken(authToken);
    await bootstrap();
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setPlayers([]);
    setMatches([]);
    setLeaderboard({ topBatsmen: [], topBowlers: [] });
    setAuctionState(null);
    setScorecard(null);
  }

  const loadScorecard = useCallback(async (matchId = selectedMatch) => {
    if (!matchId) return;
    const response = await api.get(`/matches/${matchId}/scorecard`);
    setScorecard(response.data);
  }, [selectedMatch]);

  useEffect(() => {
    if (token) {
      bootstrap();
    }
  }, [token, bootstrap]);

  useEffect(() => {
    if (!token || !selectedMatch) return;
    const socket = getAuctionSocket(token);
    socket.emit("auction:join", { matchId: selectedMatch });
    socket.on("bid:update", setAuctionState);
    socket.on("auction:start", () => bootstrap());
    socket.on("player:sold", () => bootstrap());
    return () => {
      socket.off("bid:update", setAuctionState);
      socket.disconnect();
    };
  }, [token, selectedMatch, bootstrap]);

  useEffect(() => {
    loadScorecard(selectedMatch);
  }, [selectedMatch, loadScorecard]);

  const captains = useMemo(() => players.filter((p) => p.isCaptain), [players]);
  const activeMatch = useMemo(() => matches.find((m) => m._id === selectedMatch), [matches, selectedMatch]);

  const value = {
    token,
    user,
    players,
    matches,
    captains,
    leaderboard,
    selectedMatch,
    setSelectedMatch,
    activeMatch,
    auctionState,
    scorecard,
    login,
    logout,
    bootstrap,
    loadScorecard
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
