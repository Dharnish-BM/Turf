import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "../context/useApp";

export default function ProtectedRoute() {
  const { token } = useApp();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
