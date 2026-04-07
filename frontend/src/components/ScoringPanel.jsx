import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableContainer from "@mui/material/TableContainer";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Modal from "@mui/material/Modal";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import UndoIcon from "@mui/icons-material/Undo";
import { api } from "../services/api";
import { useApp } from "../context/useApp";
import {
  batterStatsFromBalls,
  bowlerAggregatesFromBalls,
  extrasTotalsFromBalls,
  formatBallShort,
  recentOversFromBalls,
  toOverString,
  uniqueBatsmenFromBalls
} from "../utils/scoreAggregates";

function clientCanUndo(scorecard) {
  const arr = scorecard?.innings;
  if (!arr?.length) return false;
  const idx =
    arr[arr.length - 1].balls?.length > 0
      ? arr.length - 1
      : arr.length >= 2 && arr[arr.length - 2].balls?.length > 0
        ? arr.length - 2
        : -1;
  if (idx < 0) return false;
  const inn = arr[idx];
  return Boolean(inn?.balls?.length && inn.openingStriker && inn.openingNonStriker && inn.openingBowler);
}

const WICKET_TYPES = [
  { value: "caught", label: "Caught" },
  { value: "bowled", label: "Bowled" },
  { value: "lbw", label: "LBW" },
  { value: "run-out", label: "Run out" },
  { value: "stumped", label: "Stumped" },
  { value: "hit-wicket", label: "Hit wicket" },
  { value: "retired-out", label: "Retired" }
];

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function winProbabilityChase({ runsRequired, ballsRemaining, wicketsDown, currentRunRate, requiredRunRate }) {
  if (runsRequired <= 0) return 100;
  if (ballsRemaining <= 0) return 0;
  const w = clamp(10 - wicketsDown, 0, 10);
  const pressure = requiredRunRate - currentRunRate;
  let p = 50 + w * 3.5 - pressure * 9 - runsRequired * 0.35 + ballsRemaining * 0.12;
  if (ballsRemaining <= 12) {
    p -= Math.max(pressure, 0) * 6;
    p += w * 1.5;
  }
  return Math.round(clamp(p, 1, 99));
}

export default function ScoringPanel() {
  const { selectedMatch, scorecard, activeMatch, bootstrap, loadScorecard, user } = useApp();
  const [error, setError] = useState("");
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketType, setWicketType] = useState("caught");
  const [runOutPlayerId, setRunOutPlayerId] = useState("");
  const [nextBatsmanId, setNextBatsmanId] = useState("");
  const [runOutStrikeOverride, setRunOutStrikeOverride] = useState(null);
  const [wicketRuns, setWicketRuns] = useState(0);

  const isAdmin = user?.role === "admin";

  const matchOver = Boolean(scorecard?.winner);
  const inningsCount = scorecard?.innings?.length ?? 0;
  const lastInnings = inningsCount ? scorecard.innings[inningsCount - 1] : null;
  const canStartNewInnings =
    selectedMatch &&
    scorecard &&
    !matchOver &&
    (inningsCount === 0 || (lastInnings?.isComplete && inningsCount < 2));

  const innings = scorecard?.innings?.[scorecard.currentInnings] ?? null;
  const serverBowlerId = String(innings?.currentBowler?._id ?? innings?.currentBowler ?? "");
  const [bowlerDraft, setBowlerDraft] = useState("");
  const ballsFaced = innings?.ballsFaced ?? 0;
  const isLimitedOvers = (activeMatch?.format || "overs") === "overs";
  const atNewOverPickBowler = isLimitedOvers && ballsFaced > 0 && ballsFaced % 6 === 0;
  const bowlerId = atNewOverPickBowler ? bowlerDraft : bowlerDraft || serverBowlerId;
  const tossWinner = activeMatch?.toss?.winner;
  const tossDecision = activeMatch?.toss?.decision;
  const firstBattingTeam =
    tossWinner && tossDecision ? (tossDecision === "bat" ? tossWinner : tossWinner === "teamA" ? "teamB" : "teamA") : null;
  const firstBowlingTeam = firstBattingTeam ? (firstBattingTeam === "teamA" ? "teamB" : "teamA") : null;
  const defaultBattingTeam =
    inningsCount === 0 ? firstBattingTeam : innings?.battingTeam ?? (lastInnings?.bowlingTeam || firstBattingTeam);
  const defaultBowlingTeam =
    inningsCount === 0 ? firstBowlingTeam : innings?.bowlingTeam ?? (lastInnings?.battingTeam || firstBowlingTeam);
  const battingPlayers = defaultBattingTeam ? activeMatch?.teams?.[defaultBattingTeam]?.players || [] : [];
  const bowlingPlayers = defaultBowlingTeam ? activeMatch?.teams?.[defaultBowlingTeam]?.players || [] : [];

  const teamAName = activeMatch?.teams?.teamA?.name || "Team A";
  const teamBName = activeMatch?.teams?.teamB?.name || "Team B";
  const battingSideName = defaultBattingTeam === "teamA" ? teamAName : defaultBattingTeam === "teamB" ? teamBName : "Batting";

  const postScore = useCallback(
    async (body) => {
      if (!selectedMatch || !isAdmin) return;
      setError("");
      const bf = innings?.ballsFaced ?? 0;
      const limited = (activeMatch?.format || "overs") === "overs";
      const needExplicitBowler = limited && bf > 0 && bf % 6 === 0;
      if (needExplicitBowler && !body.bowler) {
        setError("New over: choose the bowler above before this delivery (runs, wide, no-ball, or wicket).");
        return;
      }
      try {
        const { data } = await api.post(`/matches/${selectedMatch}/score`, body);
        await loadScorecard(selectedMatch);
        await bootstrap();
        const innAfter = data.innings?.[data.currentInnings];
        const stack = innAfter?.balls ?? [];
        const lastBall = stack.length ? stack[stack.length - 1] : null;
        const lastWasLegal = lastBall && !["wide", "no-ball"].includes(lastBall.extras?.type || "none");
        if (lastWasLegal && innAfter?.ballsFaced > 0 && innAfter.ballsFaced % 6 === 0) {
          setBowlerDraft("");
        }
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || "Score update failed");
      }
    },
    [selectedMatch, isAdmin, loadScorecard, bootstrap, innings?.ballsFaced, activeMatch?.format]
  );

  async function onStartInnings(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!selectedMatch) return;
    setError("");
    try {
      await api.post(`/matches/${selectedMatch}/innings/start`, {
        openingBatsmanA: fd.get("openingBatsmanA"),
        openingBatsmanB: fd.get("openingBatsmanB"),
        bowler: fd.get("bowler")
      });
      await loadScorecard(selectedMatch);
      await bootstrap();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not start innings");
    }
  }

  const strikerId = innings?.striker?._id ?? innings?.striker;
  const nonStrikerId = innings?.nonStriker?._id ?? innings?.nonStriker;

  const defaultRunOutStrike = useMemo(() => {
    if (wicketType !== "run-out" || !runOutPlayerId || !nextBatsmanId || !strikerId || !nonStrikerId) {
      return "";
    }
    const survivorId = runOutPlayerId === String(strikerId) ? String(nonStrikerId) : String(strikerId);
    return runOutPlayerId === String(strikerId) ? String(nextBatsmanId) : survivorId;
  }, [wicketType, runOutPlayerId, nextBatsmanId, strikerId, nonStrikerId]);

  const runOutStrikeId = runOutStrikeOverride ?? defaultRunOutStrike;

  const balls = useMemo(() => innings?.balls ?? [], [innings]);

  const dismissedIds = useMemo(() => {
    const s = new Set();
    for (const b of balls) {
      if (b.wicket?.isWicket && b.wicket.playerOut) {
        s.add(String(b.wicket.playerOut._id ?? b.wicket.playerOut));
      }
    }
    return s;
  }, [balls]);

  const eligibleNextBatters = useMemo(() => {
    const pool = defaultBattingTeam ? activeMatch?.teams?.[defaultBattingTeam]?.players || [] : [];
    return pool.filter((p) => {
      const id = String(p._id);
      if (dismissedIds.has(id)) return false;
      if (strikerId && id === String(strikerId)) return false;
      if (nonStrikerId && id === String(nonStrikerId)) return false;
      return true;
    });
  }, [activeMatch, defaultBattingTeam, dismissedIds, strikerId, nonStrikerId]);

  const s1 = useMemo(() => batterStatsFromBalls(balls, strikerId), [balls, strikerId]);
  const s2 = useMemo(() => batterStatsFromBalls(balls, nonStrikerId), [balls, nonStrikerId]);
  const extrasLive = useMemo(() => extrasTotalsFromBalls(balls), [balls]);
  const recentOvers = useMemo(() => recentOversFromBalls(balls), [balls]);

  const totalBallsLimit = (activeMatch?.overs || 0) * 6;
  const ballsRem = innings ? Math.max(totalBallsLimit - innings.ballsFaced, 0) : 0;
  const runsReq = innings?.target ? Math.max(innings.target - innings.totalRuns, 0) : 0;
  const crr = innings?.ballsFaced ? ((innings.totalRuns * 6) / innings.ballsFaced).toFixed(2) : "0.00";
  const rrr = innings?.target && ballsRem > 0 ? ((runsReq * 6) / ballsRem).toFixed(2) : "0.00";
  const isChase = Boolean(innings?.target);
  const wp = isChase
    ? winProbabilityChase({
        runsRequired: runsReq,
        ballsRemaining: ballsRem,
        wicketsDown: innings?.wickets || 0,
        currentRunRate: Number(crr),
        requiredRunRate: Number(rrr)
      })
    : null;

  const displayInningLabel = innings?.target ? "2nd" : "1st";
  const showScoringPad = Boolean(innings && !innings.isComplete);
  const undoEnabled = isAdmin && clientCanUndo(scorecard);

  async function undoLastBall() {
    if (!selectedMatch || !isAdmin) return;
    setError("");
    try {
      await api.delete(`/matches/${selectedMatch}/score/last`);
      setBowlerDraft("");
      await loadScorecard(selectedMatch);
      await bootstrap();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Undo failed");
    }
  }

  function runPad(run) {
    postScore({
      runs: run,
      extras: { type: "none", runs: 0 },
      wicket: { isWicket: false, type: "", playerOut: null },
      nextBatsman: null,
      bowler: bowlerId || null
    });
  }

  function onWide() {
    postScore({
      runs: 0,
      extras: { type: "wide", runs: 1 },
      wicket: { isWicket: false, type: "", playerOut: null },
      nextBatsman: null,
      bowler: bowlerId || null
    });
  }

  function postNoBall(runsOffBat) {
    const r = Math.max(0, Math.min(6, Number(runsOffBat) || 0));
    postScore({
      runs: r,
      extras: { type: "no-ball", runs: 1 },
      wicket: { isWicket: false, type: "", playerOut: null },
      nextBatsman: null,
      bowler: bowlerId || null
    });
  }

  function confirmWicket() {
    const isRunOut = wicketType === "run-out";
    const outId = isRunOut ? runOutPlayerId : String(strikerId);
    const noBattersLeft = eligibleNextBatters.length === 0;
    if (isRunOut && !runOutPlayerId) {
      setError("Select which batter was run out");
      return;
    }
    if (!noBattersLeft && !nextBatsmanId) {
      setError("Select next batsman");
      return;
    }
    if (!noBattersLeft && isRunOut && !runOutStrikeId) {
      setError("Choose who faces the next ball");
      return;
    }
    const wr = Math.max(0, Math.min(6, Number(wicketRuns) || 0));
    postScore({
      runs: wr,
      extras: { type: "none", runs: 0 },
      wicket: { isWicket: true, type: wicketType, playerOut: outId },
      nextBatsman: noBattersLeft ? null : nextBatsmanId,
      bowler: bowlerId || null,
      ...(!noBattersLeft && isRunOut && runOutStrikeId ? { strikerAfterWicket: runOutStrikeId } : {})
    });
    setWicketOpen(false);
    setRunOutPlayerId("");
    setNextBatsmanId("");
    setRunOutStrikeOverride(null);
    setWicketRuns(0);
  }

  const modalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: { xs: "90%", sm: 420 },
    bgcolor: "background.paper",
    borderRadius: 2,
    boxShadow: 24,
    p: 3
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
            <Typography variant="h6">
              {teamAName} vs {teamBName}
              {innings ? ` · ${displayInningLabel} innings` : ""}
            </Typography>
            {!isAdmin && <Chip label="View only" size="small" />}
          </Stack>
        </Paper>

        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {!selectedMatch && <Alert severity="info">Open a match from the Matches page to use the scoreboard.</Alert>}

        {!showScoringPad && selectedMatch && undoEnabled && (
          <Paper sx={{ p: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2}>
              <Typography variant="body2">Between innings or innings complete — you can still undo the last ball if needed.</Typography>
              <Button variant="outlined" color="warning" startIcon={<UndoIcon />} disabled={!isAdmin} onClick={undoLastBall}>
                Undo last ball
              </Button>
            </Stack>
          </Paper>
        )}

        {selectedMatch && canStartNewInnings && !innings && (
          <Paper sx={{ p: 2 }} component="form" onSubmit={onStartInnings}>
            <Typography variant="subtitle1" gutterBottom>
              Start innings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Set toss in Matches first, then pick openers and bowler.
            </Typography>
            <Stack spacing={2} sx={{ maxWidth: 480 }}>
              <FormControl fullWidth required>
                <InputLabel>Opening batter 1</InputLabel>
                <Select name="openingBatsmanA" label="Opening batter 1" defaultValue="">
                  <MenuItem value="" disabled>
                    Choose
                  </MenuItem>
                  {battingPlayers.map((p) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Opening batter 2</InputLabel>
                <Select name="openingBatsmanB" label="Opening batter 2" defaultValue="">
                  <MenuItem value="" disabled>
                    Choose
                  </MenuItem>
                  {battingPlayers.map((p) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Opening bowler</InputLabel>
                <Select name="bowler" label="Opening bowler" defaultValue="">
                  <MenuItem value="" disabled>
                    Choose
                  </MenuItem>
                  {bowlingPlayers.map((p) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button type="submit" variant="contained" disabled={!isAdmin}>
                Start innings
              </Button>
            </Stack>
          </Paper>
        )}

        {showScoringPad && (
          <>
            <Paper sx={{ p: 2 }}>
              {isChase ? (
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    Target: {innings.target} · Need {runsReq} from {ballsRem} balls · RRR {rrr}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Win probability (estimate): {wp}%
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  First innings · {battingSideName} batting · {activeMatch?.overs || 0}-over match
                </Typography>
              )}
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
                <Typography variant="h6">
                  {battingSideName}: {innings.totalRuns}/{innings.wickets} ({toOverString(innings.ballsFaced)} ov)
                </Typography>
                <Typography color="text.secondary">CRR: {crr}</Typography>
              </Stack>
            </Paper>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Batting</TableCell>
                    <TableCell align="right">R(B)</TableCell>
                    <TableCell align="center">4s</TableCell>
                    <TableCell align="center">6s</TableCell>
                    <TableCell align="center">SR</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip size="small" label="Striker" color="primary" variant="outlined" />
                        <Typography variant="body2">{innings.striker?.name || "—"}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {s1.runs}({s1.balls})
                    </TableCell>
                    <TableCell align="center">{s1.fours}</TableCell>
                    <TableCell align="center">{s1.sixes}</TableCell>
                    <TableCell align="center">{s1.sr}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip size="small" label="Non-striker" variant="outlined" />
                        <Typography variant="body2">{innings.nonStriker?.name || "—"}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {s2.runs}({s2.balls})
                    </TableCell>
                    <TableCell align="center">{s2.fours}</TableCell>
                    <TableCell align="center">{s2.sixes}</TableCell>
                    <TableCell align="center">{s2.sr}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <FormControl fullWidth size="small" sx={{ maxWidth: 360 }}>
                  <InputLabel>Bowler (next ball)</InputLabel>
                  <Select value={bowlerId || ""} label="Bowler (next ball)" onChange={(e) => setBowlerDraft(e.target.value)}>
                    {atNewOverPickBowler && (
                      <MenuItem value="">
                        <em>New over — select bowler</em>
                      </MenuItem>
                    )}
                    {bowlingPlayers.map((p) => (
                      <MenuItem key={p._id} value={String(p._id)}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {atNewOverPickBowler && (
                    <FormHelperText>
                      After six legal balls, pick who bowls next (including for wides and no-balls). The previous bowler cannot continue.
                    </FormHelperText>
                  )}
                </FormControl>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {balls.slice(-12).map((b, i) => (
                    <Chip key={`${b.over}-${b.ball}-${balls.length - 12 + i}`} size="small" label={formatBallShort(b)} />
                  ))}
                </Stack>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Score deliveries
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                {[0, 1, 2, 3, 4, 6].map((r) => (
                  <Button key={r} variant="outlined" disabled={!isAdmin} onClick={() => runPad(r)} sx={{ minWidth: 48 }}>
                    {r}
                  </Button>
                ))}
                <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center" sx={{ width: "100%" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: "100%" }}>
                    No-ball (1 penalty + runs off bat)
                  </Typography>
                  {[0, 1, 2, 3, 4, 6].map((r) => (
                    <Button key={`nb-${r}`} size="small" variant="outlined" color="warning" disabled={!isAdmin} onClick={() => postNoBall(r)}>
                      {r === 0 ? "nb" : `nb+${r}`}
                    </Button>
                  ))}
                </Stack>
                <Button variant="outlined" color="warning" disabled={!isAdmin} onClick={onWide}>
                  wd
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  disabled={!isAdmin}
                  onClick={() => {
                    setWicketRuns(0);
                    setWicketOpen(true);
                  }}
                >
                  W
                </Button>
                <Tooltip title="Undo last ball (same innings)">
                  <span>
                    <IconButton color="warning" disabled={!undoEnabled} onClick={undoLastBall} aria-label="Undo last ball">
                      <UndoIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Typography variant="body2">
                  Extras: {extrasLive.total} (wd {extrasLive.wide}, nb {extrasLive.noBall})
                </Typography>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Recent overs
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {recentOvers.map((ro) => (
                      <TableRow key={ro.overNo}>
                        <TableCell width={48}>
                          {ro.overNo}.
                        </TableCell>
                        <TableCell>{ro.bowler}:</TableCell>
                        <TableCell>
                          <Stack direction="row" flexWrap="wrap" gap={0.5}>
                            {ro.stack.map((x, i) => (
                              <Chip key={i} label={x} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{ro.runs}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}

        {selectedMatch && scorecard?.innings?.length > 0 && (
          <>
            <Divider />
            <Typography variant="h6" sx={{ mt: 1 }}>
              Full scorecard
            </Typography>
            {scorecard.innings.map((inn, idx) => (
              <Paper key={idx} sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Innings {idx + 1} · {inn.battingTeam === "teamA" ? teamAName : teamBName} · {inn.totalRuns}-{inn.wickets} ({toOverString(inn.ballsFaced)})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Batter</TableCell>
                        <TableCell align="right">R(B)</TableCell>
                        <TableCell align="center">4s</TableCell>
                        <TableCell align="center">6s</TableCell>
                        <TableCell align="center">SR</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {uniqueBatsmenFromBalls(inn.balls).map((pid) => {
                        const st = batterStatsFromBalls(inn.balls, pid);
                        const name = inn.balls.find((b) => String(b.batsman?._id ?? b.batsman) === String(pid))?.batsman?.name || "—";
                        return (
                          <TableRow key={pid}>
                            <TableCell>{name}</TableCell>
                            <TableCell align="right">
                              {st.runs}({st.balls})
                            </TableCell>
                            <TableCell align="center">{st.fours}</TableCell>
                            <TableCell align="center">{st.sixes}</TableCell>
                            <TableCell align="center">{st.sr}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow>
                        <TableCell>Extras</TableCell>
                        <TableCell align="right" colSpan={4}>
                          {extrasTotalsFromBalls(inn.balls).total} (wd {extrasTotalsFromBalls(inn.balls).wide}, nb{" "}
                          {extrasTotalsFromBalls(inn.balls).noBall})
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Bowling
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Bowler</TableCell>
                        <TableCell align="right">O</TableCell>
                        <TableCell align="right">R</TableCell>
                        <TableCell align="center">W</TableCell>
                        <TableCell align="center">NB</TableCell>
                        <TableCell align="center">WD</TableCell>
                        <TableCell align="center">Eco</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bowlerAggregatesFromBalls(inn.balls).map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>{b.name}</TableCell>
                          <TableCell align="right">{b.overs}</TableCell>
                          <TableCell align="right">{b.runs}</TableCell>
                          <TableCell align="center">{b.wickets}</TableCell>
                          <TableCell align="center">{b.noBalls}</TableCell>
                          <TableCell align="center">{b.wides}</TableCell>
                          <TableCell align="center">{b.economy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            ))}
            {scorecard.winner && (
              <Alert severity="success">
                Result: {scorecard.winner === "draw" ? "Draw" : scorecard.winner === "teamA" ? teamAName : teamBName}
              </Alert>
            )}
          </>
        )}

        <Modal
          open={wicketOpen}
          onClose={() => {
            setWicketOpen(false);
            setRunOutStrikeOverride(null);
            setWicketRuns(0);
          }}
        >
          <Box sx={modalStyle}>
            <Typography variant="h6" gutterBottom>
              Wicket
            </Typography>
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">Dismissal</FormLabel>
              <RadioGroup
                row
                value={wicketType}
                onChange={(e) => {
                  setWicketType(e.target.value);
                  setRunOutStrikeOverride(null);
                }}
                sx={{ flexWrap: "wrap", gap: 1 }}
              >
                {WICKET_TYPES.map((t) => (
                  <FormControlLabel
                    key={t.value}
                    value={t.value}
                    control={<Radio color="secondary" />}
                    label={t.label}
                  />
                ))}
              </RadioGroup>
            </FormControl>
            {wicketType === "run-out" && (
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Batter out</InputLabel>
                <Select
                  value={runOutPlayerId}
                  label="Batter out"
                  onChange={(e) => {
                    setRunOutPlayerId(e.target.value);
                    setRunOutStrikeOverride(null);
                  }}
                >
                  <MenuItem value="">Select</MenuItem>
                  {strikerId && <MenuItem value={String(strikerId)}>{innings?.striker?.name || "Striker"}</MenuItem>}
                  {nonStrikerId && (
                    <MenuItem value={String(nonStrikerId)}>{innings?.nonStriker?.name || "Non-striker"}</MenuItem>
                  )}
                </Select>
              </FormControl>
            )}
            <FormControl component="fieldset" fullWidth sx={{ mt: 2 }}>
              <FormLabel component="legend">Runs completed off the bat (before dismissal)</FormLabel>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                e.g. 1 or 2 before a run out. For no-ball + runs, use the no-ball row on the main pad (not this wicket form).
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {[0, 1, 2, 3, 4, 6].map((r) => (
                  <Button
                    key={`wr-${r}`}
                    size="small"
                    variant={wicketRuns === r ? "contained" : "outlined"}
                    onClick={() => setWicketRuns(r)}
                  >
                    {r}
                  </Button>
                ))}
              </Stack>
            </FormControl>
            <FormControl fullWidth sx={{ mt: 2 }} required={eligibleNextBatters.length > 0}>
              <InputLabel>Next batter</InputLabel>
              <Select
                value={nextBatsmanId}
                label="Next batter"
                onChange={(e) => {
                  setNextBatsmanId(e.target.value);
                  setRunOutStrikeOverride(null);
                }}
              >
                <MenuItem value="">Select</MenuItem>
                {eligibleNextBatters.map((p) => (
                  <MenuItem key={p._id} value={p._id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
              {eligibleNextBatters.length === 0 && (
                <FormHelperText error>No eligible batters left. Confirm wicket to mark all out and end innings.</FormHelperText>
              )}
            </FormControl>
            {wicketType === "run-out" && runOutPlayerId && nextBatsmanId && (
              <FormControl component="fieldset" fullWidth sx={{ mt: 2 }}>
                <FormLabel component="legend">Who faces the next ball?</FormLabel>
                <RadioGroup
                  value={runOutStrikeId}
                  onChange={(e) => setRunOutStrikeOverride(e.target.value)}
                >
                  <FormControlLabel
                    value={String(nextBatsmanId)}
                    control={<Radio color="secondary" />}
                    label={`${battingPlayers.find((p) => String(p._id) === String(nextBatsmanId))?.name || "New batter"} — faces next ball`}
                  />
                  <FormControlLabel
                    value={runOutPlayerId === String(strikerId) ? String(nonStrikerId) : String(strikerId)}
                    control={<Radio color="secondary" />}
                    label={`${runOutPlayerId === String(strikerId) ? innings?.nonStriker?.name || "Non-striker" : innings?.striker?.name || "Striker"} — faces next ball`}
                  />
                </RadioGroup>
              </FormControl>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="flex-end">
              <Button onClick={() => setWicketOpen(false)}>Cancel</Button>
              <Button variant="contained" color="error" onClick={confirmWicket} disabled={!isAdmin}>
                Confirm
              </Button>
            </Stack>
          </Box>
        </Modal>
    </Box>
  );
}
