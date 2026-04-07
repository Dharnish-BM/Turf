import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import { useApp } from "../context/useApp";

function medal(rank) {
  if (rank === 1) return { label: "1", color: "warning" };
  if (rank === 2) return { label: "2", color: "default" };
  if (rank === 3) return { label: "3", color: "secondary" };
  return null;
}

export default function LeaderboardPage() {
  const { leaderboard } = useApp();
  const bats = leaderboard.topBatsmen || [];
  const bowls = leaderboard.topBowlers || [];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Leaderboard
        </Typography>
        <Typography color="text.secondary">Career-style totals from recorded turf matches.</Typography>
      </Box>

      <Stack direction="row" alignItems="center" spacing={1}>
        <EmojiEventsRoundedIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Top batsmen
        </Typography>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="medium">
          <TableHead>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell width={56}>#</TableCell>
              <TableCell>Player</TableCell>
              <TableCell align="right">Runs</TableCell>
              <TableCell align="right">SR</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary" align="center" py={3}>
                    No batting stats yet — score a few innings first.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              bats.map((b, i) => {
                const m = medal(i + 1);
                return (
                  <TableRow key={b._id} hover>
                    <TableCell>
                      {m ? <Chip size="small" label={m.label} color={m.color} /> : i + 1}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{b.name}</Typography>
                    </TableCell>
                    <TableCell align="right">{b.runs}</TableCell>
                    <TableCell align="right">{Number(b.strikeRate).toFixed(2)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" alignItems="center" spacing={1}>
        <EmojiEventsRoundedIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Top bowlers
        </Typography>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="medium">
          <TableHead>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell width={56}>#</TableCell>
              <TableCell>Player</TableCell>
              <TableCell align="right">Wickets</TableCell>
              <TableCell align="right">Economy</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bowls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary" align="center" py={3}>
                    No bowling stats yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              bowls.map((b, i) => {
                const m = medal(i + 1);
                return (
                  <TableRow key={b._id} hover>
                    <TableCell>
                      {m ? <Chip size="small" label={m.label} color={m.color} /> : i + 1}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{b.name}</Typography>
                    </TableCell>
                    <TableCell align="right">{b.wickets}</TableCell>
                    <TableCell align="right">{Number(b.economy).toFixed(2)}</TableCell>
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
