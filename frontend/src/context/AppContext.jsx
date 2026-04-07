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
  const [auctionError, setAuctionError] = useState("");
  const [scorecard, setScorecard] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [snackbar, setSnackbar] = useState(null);

  const showToast = useCallback((message, severity = "success") => {
    setSnackbar({ message, severity });
  }, []);

  const hideToast = useCallback(() => setSnackbar(null), []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/auth/me");
      setUser((prev) => ({ ...(prev || {}), ...data }));
    } catch {
      // ignore here; protected pages will handle auth failures
    }
  }, [token]);

  const refreshMatchInList = useCallback(async (matchId) => {
    if (!matchId) return;
    try {
      const { data } = await api.get(`/matches/${matchId}`);
      setMatches((prev) => {
        const i = prev.findIndex((m) => String(m._id) === String(matchId));
        if (i === -1) return [...prev, data];
        const next = [...prev];
        next[i] = data;
        return next;
      });
    } catch {
      showToast("Could not refresh match", "error");
    }
  }, [showToast]);

  useEffect(() => {
    setAuthToken(token);
    setUser(parseJwt(token));
  }, [token]);

  const bootstrap = useCallback(async () => {
    setBootstrapLoading(true);
    try {
      const [playersRes, matchesRes, leaderboardRes] = await Promise.all([
        api.get("/players"),
        api.get("/matches"),
        api.get("/leaderboard")
      ]);
      setPlayers(playersRes.data);
      setMatches(matchesRes.data);
      setLeaderboard(leaderboardRes.data);
    } finally {
      setBootstrapLoading(false);
    }
  }, []);

  async function login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    const authToken = response.data.token;
    localStorage.setItem("token", authToken);
    setToken(authToken);
    setAuthToken(authToken);
    try {
      const { data } = await api.get("/auth/me");
      setUser((prev) => ({ ...(prev || {}), ...data }));
    } catch {
      // ignore and continue
    }
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
    setAuctionError("");
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
    const onBidUpdate = (nextState) => {
      setAuctionError("");
      setAuctionState(nextState);
    };
    const onAuctionStart = () => bootstrap();
    const onPlayerSold = () => bootstrap();
    const onAuctionError = (message) => setAuctionError(message || "Auction action failed");
    const onScoreUpdate = (payload) => {
      if (payload?.scorecard) {
        setScorecard(payload.scorecard);
        return;
      }
      loadScorecard(selectedMatch);
    };
    const onInningsEvent = (payload) => {
      if (payload?.scorecard) {
        setScorecard(payload.scorecard);
      } else {
        loadScorecard(selectedMatch);
      }
      bootstrap();
    };
    socket.emit("auction:join", { matchId: selectedMatch });
    socket.emit("match:join", { matchId: selectedMatch });
    socket.on("bid:update", onBidUpdate);
    socket.on("auction:start", onAuctionStart);
    socket.on("player:sold", onPlayerSold);
    socket.on("auction:error", onAuctionError);
    socket.on("score:update", onScoreUpdate);
    socket.on("innings:start", onInningsEvent);
    socket.on("innings:complete", onInningsEvent);
    return () => {
      socket.off("bid:update", onBidUpdate);
      socket.off("auction:start", onAuctionStart);
      socket.off("player:sold", onPlayerSold);
      socket.off("auction:error", onAuctionError);
      socket.off("score:update", onScoreUpdate);
      socket.off("innings:start", onInningsEvent);
      socket.off("innings:complete", onInningsEvent);
      socket.disconnect();
    };
  }, [token, selectedMatch, bootstrap, loadScorecard]);

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
    auctionError,
    scorecard,
    login,
    logout,
    bootstrap,
    loadScorecard,
    bootstrapLoading,
    snackbar,
    showToast,
    hideToast,
    refreshMatchInList,
    refreshMe
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
