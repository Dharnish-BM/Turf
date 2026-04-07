import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { api } from "../services/api";
import { useApp } from "../context/useApp";

const emptyForm = { name: "", email: "", password: "", isCaptain: false };

export default function PlayersPage() {
  const { players, bootstrap, user, showToast } = useApp();
  const isAdmin = user?.role === "admin";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p) {
    setEditingId(p._id);
    setForm({ name: p.name, email: p.email, password: "", isCaptain: !!p.isCaptain });
    setDialogOpen(true);
  }

  async function savePlayer() {
    try {
      if (editingId) {
        const payload = { name: form.name, email: form.email, isCaptain: form.isCaptain };
        await api.put(`/players/${editingId}`, payload);
        showToast("Player updated");
      } else {
        await api.post("/players", {
          name: form.name,
          email: form.email,
          password: form.password,
          isCaptain: form.isCaptain
        });
        showToast("Player added");
      }
      setDialogOpen(false);
      await bootstrap();
    } catch (e) {
      showToast(e?.response?.data?.message || "Save failed", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/players/${deleteId}`);
      showToast("Player removed");
      setDeleteId(null);
      await bootstrap();
    } catch (e) {
      showToast(e?.response?.data?.message || "Delete failed", "error");
    }
  }

  return (
    <Stack spacing={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Players
          </Typography>
          <Typography color="text.secondary">Register squad members and mark auction captains.</Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} size="large">
            Add player
          </Button>
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="medium">
          <TableHead>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="center">Role</TableCell>
              {isAdmin && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {players.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 3}>
                  <Typography color="text.secondary" align="center" py={4}>
                    No players yet. Add your squad to create matches.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              players.map((p) => (
                <TableRow key={p._id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {p.name}
                      {p.isCaptain && (
                        <Chip icon={<StarRoundedIcon />} label="Captain" size="small" color="secondary" variant="outlined" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell align="center">
                    <Chip label="Player" size="small" />
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(p)} color="primary">
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteId(p._id)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit player" : "New player"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            <TextField
              label="Email"
              fullWidth
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            {!editingId && (
              <TextField
                label="Initial password"
                fullWidth
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            )}
            <FormControlLabel
              control={
                <Switch checked={form.isCaptain} onChange={(e) => setForm((f) => ({ ...f, isCaptain: e.target.checked }))} color="secondary" />
              }
              label="Auction captain (can bid, appears in captain list)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={savePlayer} disabled={!form.name || !form.email || (!editingId && !form.password)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Remove player?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This cannot be undone. Remove from database only if they have no critical history.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
