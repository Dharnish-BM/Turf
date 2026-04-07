import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import { useApp } from "../context/useApp";

const statusColor = {
  draft: "default",
  auction_live: "warning",
  ready: "info",
  live: "success",
  completed: "secondary"
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, players, matches, leaderboard, setSelectedMatch } = useApp();

  const liveMatches = useMemo(() => matches.filter((m) => m.status === "live" || m.status === "auction_live"), [matches]);
  const openMatches = useMemo(() => matches.filter((m) => m.status !== "completed"), [matches]);

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </Typography>
        <Typography color="text.secondary" variant="body1">
          Quick access to your turf operations. Open a match workspace for auction, scoring, and scorecards in one place.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <GroupsRoundedIcon color="primary" />
                <Typography variant="overline" color="text.secondary">
                  Squad
                </Typography>
              </Stack>
              <Typography variant="h3" fontWeight={700}>
                {players.length}
              </Typography>
              <Typography color="text.secondary">Players in pool</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <EmojiEventsRoundedIcon color="primary" />
                <Typography variant="overline" color="text.secondary">
                  Matches
                </Typography>
              </Stack>
              <Typography variant="h3" fontWeight={700}>
                {matches.length}
              </Typography>
              <Typography color="text.secondary">{openMatches.length} open / in progress</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <LeaderboardRoundedIcon color="primary" />
                <Typography variant="overline" color="text.secondary">
                  Form
                </Typography>
              </Stack>
              <Typography variant="h3" fontWeight={700}>
                {leaderboard.topBatsmen?.length || 0}
              </Typography>
              <Typography color="text.secondary">Tracked batters on board</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
        <Button variant="contained" size="large" startIcon={<GroupsRoundedIcon />} onClick={() => navigate("/players")}>
          Manage players
        </Button>
        <Button variant="outlined" size="large" startIcon={<EmojiEventsRoundedIcon />} onClick={() => navigate("/matches")}>
          Matches hub
        </Button>
        <Button variant="outlined" size="large" startIcon={<LeaderboardRoundedIcon />} onClick={() => navigate("/leaderboard")}>
          Leaderboard
        </Button>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Live &amp; auction
        </Typography>
        {liveMatches.length === 0 ? (
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary">No live or auction matches right now.</Typography>
              <Button sx={{ mt: 2 }} onClick={() => navigate("/matches")}>
                Go to matches
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {liveMatches.map((m) => (
              <Grid item xs={12} md={6} key={m._id}>
                <Card variant="outlined">
                  <CardActionArea
                    onClick={() => {
                      setSelectedMatch(m._id);
                      navigate(`/matches/${m._id}`);
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography fontWeight={700}>{m.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {m.teams?.teamA?.name} vs {m.teams?.teamB?.name}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {m.status === "auction_live" && <GavelRoundedIcon fontSize="small" color="warning" />}
                          {m.status === "live" && <PlayCircleOutlineRoundedIcon fontSize="small" color="success" />}
                          <Chip size="small" label={m.status.replace("_", " ")} color={statusColor[m.status] || "default"} />
                        </Stack>
                      </Stack>
                      <Typography variant="caption" color="primary.main" sx={{ mt: 1, display: "block" }}>
                        Open workspace →
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Stack>
  );
}
