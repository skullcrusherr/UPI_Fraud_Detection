// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { getAuthToken } from "../api/auth";

export default function ProtectedRoute({ children }) {
  const token = getAuthToken();

  if (!token) {
    // Not logged in → go to login page
    return <Navigate to="/" replace />;
  }

  // Logged in → allow rendering
  return children;
}
