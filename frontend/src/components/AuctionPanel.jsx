import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import { getAuctionSocket } from "../services/socket";
import { useApp } from "../context/useApp";

const MIN_BID = 5000;

function budgetsToEntries(budgets) {
  if (!budgets) return [];
  if (budgets instanceof Map) return [...budgets.entries()];
  if (typeof budgets === "object") return Object.entries(budgets);
  return [];
}

export default function AuctionPanel() {
  const { token, user, selectedMatch, auctionState, auctionError, players, bootstrap, showToast, activeMatch } = useApp();
  const [bidAmount, setBidAmount] = useState(MIN_BID);

  const isAdmin = user?.role === "admin";
  const userId = String(user?.id || user?._id || "");
  const captainAId = String(activeMatch?.teams?.teamA?.captain?._id || activeMatch?.teams?.teamA?.captain || "");
  const captainBId = String(activeMatch?.teams?.teamB?.captain?._id || activeMatch?.teams?.teamB?.captain || "");
  const isCaptainForMatch = Boolean(userId) && (userId === captainAId || userId === captainBId);

  const loaded = Boolean(auctionState);
  const status = auctionState?.status;
  const running = status === "running";
  const completed = status === "completed";
  const pending = status === "pending" || !status;

  const currentPlayer = auctionState?.currentPlayer;
  const currentName = typeof currentPlayer === "object" && currentPlayer?.name ? currentPlayer.name : null;

  const bids = useMemo(() => {
    const raw = auctionState?.bids || [];
    return [...raw].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [auctionState?.bids]);

  const highest = bids[0]?.amount || 0;
  const nextMin = Math.max(MIN_BID, highest + 500);

  const budgetEntries = useMemo(() => budgetsToEntries(auctionState?.budgets), [auctionState?.budgets]);

  const soldPlayers = auctionState?.soldPlayers || [];
  const queueLen = auctionState?.playerQueue?.length ?? 0;

  const canBidNow = isCaptainForMatch && selectedMatch && running && currentPlayer;
  const canStart = loaded && isAdmin && selectedMatch && !running && !completed && pending;
  const canSell = isAdmin && selectedMatch && running && currentPlayer;
  const topBid = bids[0] || null;

  function emitStartAuction() {
    getAuctionSocket(token).emit("auction:start", { matchId: selectedMatch });
    showToast("Starting auction…");
  }

  function emitBid() {
    const n = Number(bidAmount);
    getAuctionSocket(token).emit("bid:placed", { matchId: selectedMatch, amount: n });
  }

  function emitSold() {
    getAuctionSocket(token).emit("player:sold", { matchId: selectedMatch });
    bootstrap();
  }

  function captainLabel(id) {
    const sid = String(id);
    if (String(activeMatch?.teams?.teamA?.captain?._id) === sid) return `${activeMatch.teams.teamA.name} (A)`;
    if (String(activeMatch?.teams?.teamB?.captain?._id) === sid) return `${activeMatch.teams.teamB.name} (B)`;
    const p = players.find((x) => String(x._id) === sid);
    return p?.name || sid.slice(-6);
  }

  function playerNameFromPool(id) {
    const sid = String(id);
    const p = players.find((x) => String(x._id) === sid);
    return p?.name || "Player";
  }

  return (
    <Stack spacing={2.5}>
      <Box display="flex" flexWrap="wrap" gap={2} justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <GavelRoundedIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Live auction
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {completed ? (
            <Chip label="Auction complete" color="success" />
          ) : running ? (
            <Chip label="In progress" color="warning" />
          ) : (
            <Chip label="Not started" variant="outlined" />
          )}
        </Stack>
      </Box>

      {auctionError && <Alert severity="error">{auctionError}</Alert>}

      {!loaded && <Alert severity="info">Loading auction… If this stays, check socket connection and match selection.</Alert>}

      {!isCaptainForMatch && !isAdmin && <Alert severity="info">Only captains of this match can place bids. Admin runs the auction clock.</Alert>}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="stretch">
        <Paper variant="outlined" sx={{ flex: 1, p: 2.5 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            On the block
          </Typography>
          {running && currentName ? (
            <>
              <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ my: 1 }}>
                {currentName}
              </Typography>
              {topBid && (
                <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                  <Typography variant="overline" color="text.secondary">
                    Current highest
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="secondary.main">
                    {captainLabel(topBid.captain)}
                  </Typography>
                  <Typography variant="h5" fontWeight={900}>
                    ₹{Number(topBid.amount || 0).toLocaleString()}
                  </Typography>
                </Paper>
              )}
              <Typography variant="body2" color="text.secondary">
                Next minimum bid: <strong>₹{nextMin.toLocaleString()}</strong> (₹500 above current best)
              </Typography>
              {queueLen > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  {queueLen} player{queueLen !== 1 ? "s" : ""} left in queue after this lot.
                </Typography>
              )}
            </>
          ) : completed ? (
            <Typography color="success.main" fontWeight={600}>
              All players sold — squads are locked for this draft.
            </Typography>
          ) : (
            <Typography color="text.secondary">Start the auction when everyone is connected.</Typography>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }} flexWrap="wrap">
            <Button
              variant="contained"
              color="secondary"
              startIcon={<PlayArrowRoundedIcon />}
              disabled={!canStart}
              onClick={emitStartAuction}
            >
              Start auction
            </Button>
            <Button variant="outlined" color="success" startIcon={<SellRoundedIcon />} disabled={!canSell} onClick={emitSold}>
              Sell to highest bid
            </Button>
          </Stack>
        </Paper>

        {isCaptainForMatch && (
          <Paper variant="outlined" sx={{ flex: 1, p: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Captains — place bid
            </Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                type="number"
                label="Your bid (₹)"
                fullWidth
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                inputProps={{ min: nextMin, step: 500 }}
                helperText={`Must exceed ₹${highest.toLocaleString() || "0"} and stay within budget`}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                {[nextMin, nextMin + 5000, nextMin + 10000, nextMin + 25000].map((amt) => (
                  <Tooltip key={amt} title={`Bid ₹${amt.toLocaleString()}`}>
                    <Chip label={`₹${amt.toLocaleString()}`} onClick={() => setBidAmount(amt)} variant="outlined" />
                  </Tooltip>
                ))}
              </Stack>
              <Button variant="contained" size="large" disabled={!canBidNow || Number(bidAmount) < nextMin} onClick={emitBid}>
                Place bid
              </Button>
              {running && (
                <Typography variant="caption" color="text.secondary">
                  You are the captain for this match. Bids broadcast live to everyone in this room.
                </Typography>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
          <Typography fontWeight={700} gutterBottom>
            Captain budgets
          </Typography>
          <List dense disablePadding>
            {budgetEntries.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Budgets appear when the auction document loads.
              </Typography>
            ) : (
              budgetEntries.map(([capId, amount]) => (
                <ListItem key={String(capId)} disablePadding sx={{ py: 0.75, display: "block" }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <ListItemText primary={captainLabel(capId)} secondary={`₹${Number(amount).toLocaleString()} remaining`} />
                    {Number(amount) < 20000 && (
                      <Box sx={{ width: 72 }}>
                        <LinearProgress color="warning" variant="determinate" value={Math.min(100, (Number(amount) / 100000) * 100)} />
                      </Box>
                    )}
                  </Stack>
                </ListItem>
              ))
            )}
          </List>
        </Paper>

        <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
          <Typography fontWeight={700} gutterBottom>
            Current round bids
          </Typography>
          {bids.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No bids yet — open with at least ₹{MIN_BID.toLocaleString()}.
            </Typography>
          ) : (
            <List dense disablePadding>
              {bids.map((b, i) => (
                <ListItem key={`${b.captain}-${b.amount}-${i}`} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={`₹${Number(b.amount).toLocaleString()}`}
                    secondary={typeof b.captain === "object" && b.captain?.name ? b.captain.name : captainLabel(b.captain)}
                  />
                  {i === 0 && <Chip size="small" label="Highest" color="secondary" />}
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography fontWeight={700} gutterBottom>
          Sold players
        </Typography>
        {soldPlayers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Sales will appear here after each hammer drop.
          </Typography>
        ) : (
          <List dense>
            {soldPlayers.map((row, idx) => {
              const pid = row.player?._id || row.player;
              const cid = row.captain?._id || row.captain;
              const pname = row.player?.name || playerNameFromPool(pid);
              return (
                <ListItem key={`${String(pid)}-${idx}`} disablePadding divider={idx < soldPlayers.length - 1}>
                  <ListItemText primary={pname} secondary={`To ${captainLabel(cid)} · ₹${Number(row.amount).toLocaleString()}`} />
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>
    </Stack>
  );
}
