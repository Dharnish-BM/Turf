import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { useApp } from "../context/useApp";

export default function GlobalSnackbar() {
  const { snackbar, hideToast } = useApp();
  return (
    <Snackbar
      open={Boolean(snackbar)}
      autoHideDuration={5000}
      onClose={hideToast}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert onClose={hideToast} severity={snackbar?.severity || "info"} variant="filled" sx={{ width: "100%" }}>
        {snackbar?.message}
      </Alert>
    </Snackbar>
  );
}
