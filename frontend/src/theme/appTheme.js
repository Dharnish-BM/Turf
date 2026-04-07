import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0d5c3d",
      light: "#1b7a54",
      dark: "#08422a",
      contrastText: "#ffffff"
    },
    secondary: {
      main: "#c9a227",
      dark: "#9a7b1c",
      contrastText: "#1a1a1a"
    },
    background: {
      default: "#f4f7f5",
      paper: "#ffffff"
    },
    text: {
      primary: "#142018",
      secondary: "#4a5c52"
    },
    divider: "rgba(13, 92, 61, 0.12)"
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"DM Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 }
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10 }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 }
      }
    }
  }
});
