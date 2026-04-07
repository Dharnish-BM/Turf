import { useState } from "react";
import { Navigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useApp } from "../context/useApp";

export default function LoginPage() {
  const { token, login, showToast } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      showToast("Welcome back");
    } catch (err) {
      showToast(err?.response?.data?.message || "Login failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        background: "linear-gradient(145deg, #0d5c3d 0%, #142018 45%, #1a2e24 100%)"
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 420,
          width: 1,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)"
        }}
        component="form"
        onSubmit={onSubmit}
      >
        <Stack spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <SportsCricketRoundedIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box textAlign="center">
            <Typography variant="h5" fontWeight={700}>
              Turf Cricket Manager
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to manage players, matches, and live scoring
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={2}>
          <TextField
            required
            fullWidth
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlinedIcon color="action" />
                </InputAdornment>
              )
            }}
          />
          <TextField
            required
            fullWidth
            label="Password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton aria-label="toggle password" onClick={() => setShowPw((v) => !v)} edge="end" size="small">
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ py: 1.25 }}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            First-time setup: create admin with POST{" "}
            <Box component="code" sx={{ bgcolor: "grey.100", px: 0.5, borderRadius: 0.5, fontSize: "0.75rem" }}>
              /api/auth/register-admin
            </Box>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
