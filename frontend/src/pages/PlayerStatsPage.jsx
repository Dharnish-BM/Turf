import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { api } from "../services/api";

function n2(x) {
  return Number(x || 0).toFixed(2);
}

export default function PlayerStatsPage() {
  const { playerId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    api
      .get(`/players/${playerId}/stats`)
      .then((res) => {
        if (!cancelled) {
          setError("");
          setData(res.data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setError(e?.response?.data?.message || e?.message || "Could not load stats");
          setLoading(false);
        }
      });
    // Loading state is derived from whether the loaded data matches the route param.
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const loadingDerived = Boolean(playerId && String(data?.player?._id || "") !== String(playerId) && !error);
  const history = useMemo(() => data?.history || [], [data]);
  const career = data?.career;

  const charts = useMemo(() => {
    const ordered = [...history].reverse();
    return ordered.map((h, idx) => ({
      idx: idx + 1,
      match: h.matchName || `Match ${idx + 1}`,
      runs: h.batting?.runs || 0,
      sr: h.batting?.balls ? (h.batting.runs / h.batting.balls) * 100 : 0,
      wickets: h.bowling?.wickets || 0,
      eco: h.bowling?.balls ? (h.bowling.runs / h.bowling.balls) * 6 : 0
    }));
  }, [history]);

  return (
    <Stack spacing={2.5}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          Dashboard
        </Link>
        <Link component={RouterLink} to="/players" underline="hover" color="inherit">
          Players
        </Link>
        <Typography color="text.primary" fontWeight={600}>
          Stats
        </Typography>
      </Breadcrumbs>

      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            {data?.player?.name || "Player stats"}
          </Typography>
          <Typography color="text.secondary">
            Personal analytics from recorded scorecards
            {career ? ` · ${career.matches} match${career.matches === 1 ? "" : "es"}` : ""}
          </Typography>
        </Box>
        <Button component={RouterLink} to="/players" variant="outlined">
          Back
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {(loading || loadingDerived) && <Alert severity="info">Loading…</Alert>}

      {career && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography fontWeight={800} gutterBottom>
              Batting
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip label={`Innings ${career.batting.innings}`} />
              <Chip label={`Runs ${career.batting.runs}`} color="primary" />
              <Chip label={`Balls ${career.batting.balls}`} />
              <Chip label={`SR ${n2(career.batting.sr)}`} />
              <Chip label={`4s ${career.batting.fours}`} />
              <Chip label={`6s ${career.batting.sixes}`} />
              <Chip label={`Outs ${career.batting.outs}`} />
              <Chip label={`Best ${career.batting.best}`} />
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Typography fontWeight={800} gutterBottom>
              Bowling
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip label={`Innings ${career.bowling.innings}`} />
              <Chip label={`Wickets ${career.bowling.wickets}`} color="secondary" />
              <Chip label={`Runs ${career.bowling.runs}`} />
              <Chip label={`Balls ${career.bowling.balls}`} />
              <Chip label={`Eco ${n2(career.bowling.economy)}`} />
              <Chip label={`Best ${career.bowling.bestW}/${career.bowling.bestRuns}`} />
            </Stack>
          </Paper>
        </Stack>
      )}

      {charts.length > 0 && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight={800} gutterBottom>
              Performance trend
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              By match order (old → new)
            </Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="runs" stroke="#1976d2" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="wickets" stroke="#9c27b0" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight={800} gutterBottom>
              Rate metrics
            </Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
              <TableCell align="right">Wkts</TableCell>
              <TableCell align="right">Eco</TableCell>
              <TableCell align="right">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" align="center" py={3}>
                    No match history yet for this player.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              history.map((h) => {
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

