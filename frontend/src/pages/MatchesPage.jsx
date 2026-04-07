import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { api } from "../services/api";
import { useApp } from "../context/useApp";

const statusConfig = {
  draft: { label: "Draft", color: "default" },
  auction_live: { label: "Auction live", color: "warning" },
  ready: { label: "Ready", color: "info" },
  live: { label: "Live", color: "success" },
  completed: { label: "Completed", color: "secondary" }
};

export default function MatchesPage() {
  const navigate = useNavigate();
  const { players, captains, matches, bootstrap, user, showToast, setSelectedMatch } = useApp();
  const isAdmin = user?.role === "admin";
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    teamA: "",
    teamB: "",
    captainA: "",
    captainB: "",
    mode: "manual",
    overs: 10
  });

  async function createMatch(e) {
    e.preventDefault();
    try {
      const { data } = await api.post("/matches", {
        name: form.name,
        players: players.map((p) => p._id),
        mode: form.mode,
        format: "overs",
        overs: Number(form.overs) || 10,
        teams: {
          teamA: { name: form.teamA, captain: form.captainA, players: [] },
          teamB: { name: form.teamB, captain: form.captainB, players: [] }
        }
      });
      showToast("Match created");
      setCreateOpen(false);
      setForm({ name: "", teamA: "", teamB: "", captainA: "", captainB: "", mode: "manual", overs: 10 });
      await bootstrap();
      setSelectedMatch(data._id);
      navigate(`/matches/${data._id}`);
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not create match", "error");
    }
  }

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Matches
          </Typography>
          <Typography color="text.secondary">Create fixtures, then open a workspace for toss, auction, and scoring.</Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" size="large" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
            New match
          </Button>
        )}
      </Box>

      <Grid container spacing={2}>
        {matches.length === 0 ? (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  No matches yet.
                </Typography>
                {isAdmin && <Button onClick={() => setCreateOpen(true)}>Create your first match</Button>}
              </CardContent>
            </Card>
          </Grid>
        ) : (
          matches.map((m) => {
            const st = statusConfig[m.status] || statusConfig.draft;
            return (
              <Grid item xs={12} sm={6} md={4} key={m._id}>
                <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Typography fontWeight={700} variant="h6">
                        {m.name}
                      </Typography>
                      <Chip size="small" label={st.label} color={st.color} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {m.teams?.teamA?.name} vs {m.teams?.teamB?.name}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      {m.mode === "auction" ? "Auction squads" : "Manual teams"} · {m.overs || 10} overs
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      fullWidth
                      endIcon={<OpenInNewRoundedIcon />}
                      onClick={() => {
                        setSelectedMatch(m._id);
                        navigate(`/matches/${m._id}`);
                      }}
                    >
                      Open workspace
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })
        )}
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm" component="form" onSubmit={createMatch}>
        <DialogTitle>New match</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              required
              label="Match name"
              fullWidth
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Friday Night Turf"
            />
            <TextField
              required
              label="Team A name"
              fullWidth
              value={form.teamA}
              onChange={(e) => setForm((f) => ({ ...f, teamA: e.target.value }))}
            />
            <TextField
              required
              label="Team B name"
              fullWidth
              value={form.teamB}
              onChange={(e) => setForm((f) => ({ ...f, teamB: e.target.value }))}
            />
            <TextField
              required
              select
              label="Captain A"
              fullWidth
              value={form.captainA}
              onChange={(e) => setForm((f) => ({ ...f, captainA: e.target.value }))}
            >
              {captains.map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              select
              label="Captain B"
              fullWidth
              value={form.captainB}
              onChange={(e) => setForm((f) => ({ ...f, captainB: e.target.value }))}
            >
              {captains.map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Formation" fullWidth value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
              <MenuItem value="manual">Manual teams</MenuItem>
              <MenuItem value="auction">Auction</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Overs"
              fullWidth
              inputProps={{ min: 1 }}
              value={form.overs}
              onChange={(e) => setForm((f) => ({ ...f, overs: e.target.value }))}
            />
            <Typography variant="caption" color="text.secondary">
              All current players are included in the player pool. Captains must be flagged on the Players page.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={captains.length < 2}>
            Create &amp; open
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
