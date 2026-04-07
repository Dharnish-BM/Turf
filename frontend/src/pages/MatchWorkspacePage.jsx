import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import SportsScoreRoundedIcon from "@mui/icons-material/SportsScoreRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import { api } from "../services/api";
import { useApp } from "../context/useApp";
import AuctionPanel from "../components/AuctionPanel";
import ScoringPanel from "../components/ScoringPanel";
import SquadBoard from "../components/SquadBoard";

const statusConfig = {
  draft: { label: "Draft", color: "default" },
  auction_live: { label: "Auction live", color: "warning" },
  ready: { label: "Ready for toss / start", color: "info" },
  live: { label: "Live", color: "success" },
  completed: { label: "Completed", color: "secondary" }
};

export default function MatchWorkspacePage() {
  const { matchId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { matches, activeMatch, setSelectedMatch, refreshMatchInList, user, bootstrap, showToast, bootstrapLoading } = useApp();
  const matchRow = useMemo(() => matches.find((m) => String(m._id) === String(matchId)), [matches, matchId]);
  const isAdmin = user?.role === "admin";
  const [setupDraft, setSetupDraft] = useState({ format: "overs", overs: 10 });
  const [setupDirty, setSetupDirty] = useState(false);

  const tabParam = searchParams.get("tab") || "overview";
  const displayMatch = matchRow || activeMatch;
  const isAuctionMatch = displayMatch?.mode === "auction";
  const setupBase = useMemo(() => {
    return {
      format: displayMatch?.format || "overs",
      overs: displayMatch?.overs || 10
    };
  }, [displayMatch?.format, displayMatch?.overs]);
  const setupValue = setupDirty ? setupDraft : setupBase;

  const validTab = useMemo(() => {
    const allowed = isAuctionMatch ? ["overview", "auction", "scoring"] : ["overview", "scoring"];
    return allowed.includes(tabParam) ? tabParam : "overview";
  }, [tabParam, isAuctionMatch]);

  useEffect(() => {
    if (!matchId) return;
    setSelectedMatch(matchId);
    refreshMatchInList(matchId);
    return () => setSelectedMatch("");
  }, [matchId, setSelectedMatch, refreshMatchInList]);

  useEffect(() => {
    if (tabParam !== validTab) {
      setSearchParams({ tab: validTab }, { replace: true });
    }
  }, [tabParam, validTab, setSearchParams]);

  const tabIndex = validTab === "overview" ? 0 : validTab === "auction" ? 1 : isAuctionMatch ? 2 : 1;

  function onTabChange(_, idx) {
    const next =
      idx === 0 ? "overview" : idx === 1 ? (isAuctionMatch ? "auction" : "scoring") : "scoring";
    setSearchParams({ tab: next }, { replace: true });
  }

  async function submitToss(e) {
    e.preventDefault();
    if (!matchId || !isAdmin) return;
    const fd = new FormData(e.currentTarget);
    try {
      await api.post(`/matches/${matchId}/toss`, {
        winner: fd.get("winner"),
        decision: fd.get("decision")
      });
      showToast("Toss saved — match ready to start");
      await bootstrap();
      await refreshMatchInList(matchId);
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not save toss", "error");
    }
  }

  async function submitSetup(e) {
    e.preventDefault();
    if (!matchId || !isAdmin) return;
    try {
      await api.patch(`/matches/${matchId}/setup`, {
        format: setupValue.format,
        overs: setupValue.format === "overs" ? Number(setupValue.overs) : undefined
      });
      showToast("Match setup saved");
      setSetupDirty(false);
      await bootstrap();
      await refreshMatchInList(matchId);
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not save match setup", "error");
    }
  }

  if (!matchId) {
    return (
      <Button component={RouterLink} to="/matches">
        Back to matches
      </Button>
    );
  }

  if (!displayMatch) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={700}>
          {bootstrapLoading ? "Loading match…" : "Match not found"}
        </Typography>
        <Typography color="text.secondary">
          {bootstrapLoading ? "Fetching your fixtures." : "It may have been removed or you may not have access."}
        </Typography>
        <Button component={RouterLink} to="/matches">
          Back to matches
        </Button>
      </Stack>
    );
  }

  const st = statusConfig[displayMatch.status] || statusConfig.draft;
  const teamAName = displayMatch.teams?.teamA?.name || "Team A";
  const teamBName = displayMatch.teams?.teamB?.name || "Team B";
  const canDnDSquads =
    isAdmin && displayMatch.status !== "live" && displayMatch.status !== "completed";
  const canEditSetup = isAdmin && !displayMatch.toss?.winner && displayMatch.status !== "live" && displayMatch.status !== "completed";

  return (
    <Stack spacing={2.5}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          Dashboard
        </Link>
        <Link component={RouterLink} to="/matches" underline="hover" color="inherit">
          Matches
        </Link>
        <Typography color="text.primary" fontWeight={600}>
          {displayMatch.name}
        </Typography>
      </Breadcrumbs>

      <Box display="flex" flexWrap="wrap" gap={2} alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {displayMatch.name}
          </Typography>
          <Typography color="text.secondary">
            {teamAName} vs {teamBName} · {displayMatch.overs || 10} overs
          </Typography>
        </Box>
        <Chip label={st.label} color={st.color} sx={{ fontWeight: 600 }} />
      </Box>

      <Tabs
        value={tabIndex}
        onChange={onTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab icon={<DashboardRoundedIcon />} iconPosition="start" label="Overview" />
        {isAuctionMatch && <Tab icon={<GavelRoundedIcon />} iconPosition="start" label="Auction" />}
        <Tab icon={<SportsScoreRoundedIcon />} iconPosition="start" label="Scoring" />
      </Tabs>

      {validTab === "overview" && (
        <Stack spacing={2}>
          {canEditSetup && (
            <Card variant="outlined" component="form" onSubmit={submitSetup}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Match setup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Set format and overs before recording the toss.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
                  <TextField
                    select
                    required
                    label="Format"
                    value={setupValue.format}
                    onChange={(e) => {
                      if (!setupDirty) {
                        setSetupDraft(setupBase);
                        setSetupDirty(true);
                      }
                      setSetupDraft((s) => ({ ...s, format: e.target.value }));
                    }}
                    sx={{ minWidth: 220 }}
                  >
                    <MenuItem value="overs">Overs</MenuItem>
                    <MenuItem value="test">Test (unlimited balls)</MenuItem>
                  </TextField>
                  <TextField
                    type="number"
                    required={setupValue.format === "overs"}
                    disabled={setupValue.format !== "overs"}
                    label="Overs"
                    value={setupValue.overs}
                    onChange={(e) => {
                      if (!setupDirty) {
                        setSetupDraft(setupBase);
                        setSetupDirty(true);
                      }
                      setSetupDraft((s) => ({ ...s, overs: e.target.value }));
                    }}
                    inputProps={{ min: 1 }}
                    sx={{ minWidth: 160 }}
                  />
                  <Button type="submit" variant="contained" sx={{ mt: { xs: 0, sm: 0.5 } }}>
                    Save setup
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <SportsCricketRoundedIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Squads
                </Typography>
              </Stack>
              <SquadBoard
                matchId={matchId}
                displayMatch={displayMatch}
                canEdit={canDnDSquads}
                onSaved={
                  canDnDSquads
                    ? (err) => {
                        if (err) {
                          showToast(err?.response?.data?.message || "Could not update squads", "error");
                          return;
                        }
                        showToast("Squads saved");
                        void refreshMatchInList(matchId);
                        void bootstrap();
                      }
                    : undefined
                }
              />
              {isAuctionMatch && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Squads are filled during the auction. Drag-and-drop editing applies to manual matches only (admin, before the match goes live).
                </Typography>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card variant="outlined" component="form" onSubmit={submitToss}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Toss
                </Typography>
                {displayMatch.toss?.winner ? (
                  <Alert severity="success">
                    {displayMatch.toss.winner === "teamA" ? teamAName : teamBName} won the toss and chose to{" "}
                    <strong>{displayMatch.toss.decision}</strong>.
                  </Alert>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Record the toss before starting the first innings (scoring tab).
                  </Typography>
                )}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
                  <TextField select required name="winner" label="Toss winner" defaultValue={displayMatch.toss?.winner || ""} sx={{ minWidth: 200 }}>
                    <MenuItem value="teamA">{teamAName}</MenuItem>
                    <MenuItem value="teamB">{teamBName}</MenuItem>
                  </TextField>
                  <TextField select required name="decision" label="Decision" defaultValue={displayMatch.toss?.decision || ""} sx={{ minWidth: 180 }}>
                    <MenuItem value="bat">Bat</MenuItem>
                    <MenuItem value="bowl">Bowl</MenuItem>
                  </TextField>
                  <Button type="submit" variant="contained" sx={{ mt: { xs: 0, sm: 0.5 } }} disabled={!isAdmin}>
                    Save toss
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {!isAdmin && !displayMatch.toss?.winner && (
            <Alert severity="info">Ask an admin to set the toss before the match can start.</Alert>
          )}

          {isAuctionMatch && displayMatch.status === "draft" && (
            <Alert severity="warning" icon={<GavelRoundedIcon />}>
              Open the <strong>Auction</strong> tab and start the auction when both captains are ready.
            </Alert>
          )}
        </Stack>
      )}

      {validTab === "auction" && isAuctionMatch && <AuctionPanel />}

      {validTab === "auction" && !isAuctionMatch && (
        <Alert severity="info">This fixture uses manual team assignment — there is no auction.</Alert>
      )}

      {validTab === "scoring" && <ScoringPanel />}
    </Stack>
  );
}
