import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Container from "@mui/material/Container";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import LeaderboardRoundedIcon from "@mui/icons-material/LeaderboardRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricketRounded";
import LinearProgress from "@mui/material/LinearProgress";
import GlobalSnackbar from "../components/GlobalSnackbar";
import { useApp } from "../context/useApp";

const DRAWER_WIDTH = 268;

const navItems = [
  { to: "/", label: "Dashboard", icon: DashboardRoundedIcon },
  { to: "/players", label: "Players", icon: GroupsRoundedIcon },
  { to: "/matches", label: "Matches", icon: EmojiEventsRoundedIcon },
  { to: "/leaderboard", label: "Leaderboard", icon: LeaderboardRoundedIcon }
];

function NavList({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <List sx={{ px: 1, pt: 2 }}>
      {navItems.map((item) => {
        const { to, label, icon: IconComponent } = item;
        const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
        return (
          <ListItem key={to} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={active}
              onClick={() => {
                navigate(to);
                onNavigate?.();
              }}
              sx={{
                borderRadius: 2,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "inherit" }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: active ? "inherit" : "primary.main" }}>
                <IconComponent />
              </ListItemIcon>
              <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

export default function MainLayout() {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout, bootstrapLoading } = useApp();

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ px: 2, gap: 1 }}>
        <SportsCricketRoundedIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main" lineHeight={1.2}>
            Turf Cricket
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Match control center
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <NavList onNavigate={() => setMobileOpen(false)} />
      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ mx: 2 }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Signed in as
        </Typography>
        <Typography variant="body2" fontWeight={600} noWrap>
          {user?.name || user?.email || "User"}
        </Typography>
        <Typography variant="caption" color="primary.main">
          {user?.role === "admin" ? "Administrator" : "Player"}
          {user?.isCaptain ? " · Captain" : ""}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { lg: `${DRAWER_WIDTH}px` },
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper"
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2, display: { lg: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }} />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: "0.95rem" }}>
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                logout();
              }}
            >
              <ListItemIcon>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
              Log out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { lg: DRAWER_WIDTH }, flexShrink: { lg: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", lg: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", lg: "block" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH, borderRight: 1, borderColor: "divider" }
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar />
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
          {bootstrapLoading && (
            <Box
              sx={{
                position: "fixed",
                top: 64,
                left: { xs: 0, lg: DRAWER_WIDTH },
                right: 0,
                zIndex: theme.zIndex.drawer + 1
              }}
            >
              <LinearProgress />
            </Box>
          )}
          <GlobalSnackbar />
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
