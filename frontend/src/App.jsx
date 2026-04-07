import { Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import MainLayout from "./layout/MainLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PlayersPage from "./pages/PlayersPage";
import PlayerStatsPage from "./pages/PlayerStatsPage";
import ProfilePage from "./pages/ProfilePage";
import MatchesPage from "./pages/MatchesPage";
import MatchWorkspacePage from "./pages/MatchWorkspacePage";
import LeaderboardPage from "./pages/LeaderboardPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="players/:playerId" element={<PlayerStatsPage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="matches/:matchId" element={<MatchWorkspacePage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </>
  );
}
