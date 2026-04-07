import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { api } from "../services/api";
import { useApp } from "../context/useApp";

function n2(x) {
  return Number(x || 0).toFixed(2);
}

export default function ProfilePage() {
  const { user, showToast, refreshMe } = useApp();
  const [profileDraft, setProfileDraft] = useState({ name: "", avatarUrl: "" });
  const [profileDirty, setProfileDirty] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [stats, setStats] = useState(null);
  const [statsForId, setStatsForId] = useState("");

  const profileBase = useMemo(
    () => ({
      name: user?.name || "",
      avatarUrl: user?.avatarUrl || ""
    }),
    [user?.name, user?.avatarUrl]
  );
  const profile = profileDirty ? profileDraft : profileBase;

  useEffect(() => {
    if (!user?.id && !user?._id) return;
    const pid = user?.id || user?._id;
    api
      .get(`/players/${pid}/stats`)
      .then((res) => {
        setStats(res.data);
        setStatsForId(String(pid));
      })
      .catch(() => {
        setStatsForId(String(pid));
      });
  }, [user?.id, user?._id]);

  const chartData = useMemo(() => {
    const history = stats?.history || [];
    return [...history].reverse().map((h, idx) => ({
      idx: idx + 1,
      runs: h.batting?.runs || 0,
      wickets: h.bowling?.wickets || 0,
      sr: h.batting?.balls ? (h.batting.runs / h.batting.balls) * 100 : 0,
      eco: h.bowling?.balls ? (h.bowling.runs / h.bowling.balls) * 6 : 0
    }));
  }, [stats]);

  const pieRuns = useMemo(() => {
    const batting = stats?.career?.batting;
    if (!batting) return [];
    const foursRuns = (batting.fours || 0) * 4;
    const sixesRuns = (batting.sixes || 0) * 6;
    const otherRuns = Math.max((batting.runs || 0) - foursRuns - sixesRuns, 0);
    return [
      { name: "Fours", value: foursRuns },
      { name: "Sixes", value: sixesRuns },
      { name: "Other runs", value: otherRuns }
    ].filter((x) => x.value > 0);
  }, [stats]);

  const pieDismissals = useMemo(() => {
    const batting = stats?.career?.batting;
    if (!batting) return [];
    const outs = batting.outs || 0;
    const notOuts = Math.max((batting.innings || 0) - outs, 0);
    return [
      { name: "Out", value: outs },
      { name: "Not out", value: notOuts }
    ].filter((x) => x.value > 0);
  }, [stats]);

  async function saveProfile() {
    try {
      await api.put("/auth/me", profile);
      setProfileDirty(false);
      await refreshMe();
      showToast("Profile updated");
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not update profile", "error");
    }
  }

  async function savePassword() {
    if (!pw.currentPassword || !pw.newPassword) {
      showToast("Fill current and new password", "error");
      return;
    }
    if (pw.newPassword !== pw.confirm) {
      showToast("New password and confirm do not match", "error");
      return;
    }
    try {
      await api.put("/auth/me/password", {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword
      });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      showToast("Password updated");
    } catch (e) {
      showToast(e?.response?.data?.message || "Could not update password", "error");
    }
  }

  function onAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!profileDirty) {
        setProfileDraft(profileBase);
        setProfileDirty(true);
      }
      setProfileDraft((p) => ({ ...p, avatarUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  }

  const roleText = user?.role === "admin" ? "Administrator" : "Player";
  const captainText = user?.isCaptain ? "Captain" : "";

  return (
    <Stack spacing={2.5}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={profile.avatarUrl || undefined} sx={{ width: 64, height: 64 }}>
            {(profile.name || user?.email || "?").charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              My Profile
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Chip label={roleText} size="small" color="primary" variant="outlined" />
              {captainText ? <Chip label={captainText} size="small" color="secondary" variant="outlined" /> : null}
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography fontWeight={800} gutterBottom>
            Personal details
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Name"
              value={profile.name}
              onChange={(e) => {
                if (!profileDirty) {
                  setProfileDraft(profileBase);
                  setProfileDirty(true);
                }
                setProfileDraft((p) => ({ ...p, name: e.target.value }));
              }}
            />
            <TextField label="Email" value={user?.email || ""} disabled />
            <TextField
              label="Avatar URL"
              value={profile.avatarUrl}
              onChange={(e) => {
                if (!profileDirty) {
                  setProfileDraft(profileBase);
                  setProfileDirty(true);
                }
                setProfileDraft((p) => ({ ...p, avatarUrl: e.target.value }));
              }}
            />
            <Button variant="outlined" component="label">
              Upload profile image
              <input hidden type="file" accept="image/*" onChange={onAvatarFile} />
            </Button>
            <Button variant="contained" onClick={saveProfile}>
              Save profile
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography fontWeight={800} gutterBottom>
            Change password
          </Typography>
          <Stack spacing={2}>
            <TextField
              type="password"
              label="Current password"
              value={pw.currentPassword}
              onChange={(e) => setPw((x) => ({ ...x, currentPassword: e.target.value }))}
            />
            <TextField
              type="password"
              label="New password"
              value={pw.newPassword}
              onChange={(e) => setPw((x) => ({ ...x, newPassword: e.target.value }))}
            />
            <TextField
              type="password"
              label="Confirm new password"
              value={pw.confirm}
              onChange={(e) => setPw((x) => ({ ...x, confirm: e.target.value }))}
            />
            <Button variant="contained" color="secondary" onClick={savePassword}>
              Update password
            </Button>
          </Stack>
        </Paper>
      </Stack>

      <Divider />
      <Typography variant="h6" fontWeight={800}>
        Performance dashboard
      </Typography>
      {Boolean((user?.id || user?._id) && statsForId !== String(user?.id || user?._id)) && <Alert severity="info">Loading stats…</Alert>}

      {stats?.career && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography fontWeight={700}>Batting</Typography>
            <Typography variant="body2" color="text.secondary">
              Matches {stats.career.matches} · Runs {stats.career.batting.runs} · SR {n2(stats.career.batting.sr)} · Best {stats.career.batting.best}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography fontWeight={700}>Bowling</Typography>
            <Typography variant="body2" color="text.secondary">
              Wickets {stats.career.bowling.wickets} · Eco {n2(stats.career.bowling.economy)} · Best {stats.career.bowling.bestW}/{stats.career.bowling.bestRuns}
            </Typography>
          </Paper>
        </Stack>
      )}

      {chartData.length > 0 && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight={700} gutterBottom>
              Runs and wickets trend
            </Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="runs" stroke="#1976d2" />
                  <Line type="monotone" dataKey="wickets" stroke="#9c27b0" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight={700} gutterBottom>
              SR and economy
            </Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sr" fill="#2e7d32" />
                  <Bar dataKey="eco" fill="#ed6c02" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography fontWeight={700} gutterBottom>
                Run composition
              </Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieRuns} dataKey="value" nameKey="name" outerRadius={90}>
                      {pieRuns.map((_, i) => (
                        <Cell key={i} fill={["#1976d2", "#9c27b0", "#2e7d32"][i % 3]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography fontWeight={700} gutterBottom>
                Dismissal profile
              </Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieDismissals} dataKey="value" nameKey="name" outerRadius={90}>
                      {pieDismissals.map((_, i) => (
                        <Cell key={i} fill={["#ed6c02", "#0288d1"][i % 2]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Stack>
        </Stack>
      )}

      <Divider />
      <Typography variant="h6" fontWeight={800}>
        Match history
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell>Match</TableCell>
              <TableCell align="right">Runs</TableCell>
              <TableCell align="right">Balls</TableCell>
              <TableCell align="right">SR</TableCell>
              <TableCell align="right">Wickets</TableCell>
              <TableCell align="right">Eco</TableCell>
              <TableCell align="right">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(stats?.history || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" align="center" py={3}>
                    No match history yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              (stats?.history || []).map((h) => {
                const sr = h.batting?.balls ? (h.batting.runs / h.batting.balls) * 100 : 0;
                const eco = h.bowling?.balls ? (h.bowling.runs / h.bowling.balls) * 6 : 0;
                return (
                  <TableRow key={h.matchId} hover>
                    <TableCell>
                      <Typography fontWeight={700}>{h.matchName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {h.battingTeamA} vs {h.battingTeamB}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{h.batting?.runs || 0}</TableCell>
                    <TableCell align="right">{h.batting?.balls || 0}</TableCell>
                    <TableCell align="right">{n2(sr)}</TableCell>
                    <TableCell align="right">{h.bowling?.wickets || 0}</TableCell>
                    <TableCell align="right">{n2(eco)}</TableCell>
                    <TableCell align="right">{h.status}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

