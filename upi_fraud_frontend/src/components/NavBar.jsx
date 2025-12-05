// src/components/NavBar.jsx
import { useLocation, useNavigate } from "react-router-dom";

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("upi_token");
    navigate("/");
  };

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <div style={styles.logo} onClick={() => navigate("/scanner")}>
          <span style={styles.logoAccent}>UPI</span> Guard
        </div>

        <nav style={styles.navButtons}>
          <button
            style={{
              ...styles.navBtn,
              ...(isActive("/scanner") ? styles.navBtnActive : {}),
            }}
            onClick={() => navigate("/scanner")}
          >
            Scanner
          </button>
          <button
            style={{
              ...styles.navBtn,
              ...(isActive("/dashboard") ? styles.navBtnActive : {}),
            }}
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>
          <button
            style={{
              ...styles.navBtn,
              ...(isActive("/history") ? styles.navBtnActive : {}),
            }}
            onClick={() => navigate("/history")}
          >
            History
          </button>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backdropFilter: "blur(14px)",
    background:
      "linear-gradient(to right, rgba(15,23,42,0.95), rgba(2,6,23,0.95))",
    borderBottom: "1px solid rgba(148,163,184,0.25)",
  },
  inner: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "10px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
  },
  logo: {
    fontWeight: 700,
    fontSize: "20px",
    letterSpacing: "0.03em",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  logoAccent: {
    padding: "2px 8px",
    borderRadius: "999px",
    background:
      "linear-gradient(135deg, #4f46e5, #22c55e)",
    color: "#0b1020",
    fontSize: "14px",
  },
  navButtons: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  navBtn: {
    borderRadius: "999px",
    padding: "7px 14px",
    border: "1px solid rgba(148,163,184,0.4)",
    background: "transparent",
    color: "#e5e7eb",
    fontSize: "13px",
    cursor: "pointer",
  },
  navBtnActive: {
    background:
      "linear-gradient(135deg, #4f46e5, #22c55e)",
    borderColor: "transparent",
    color: "#020617",
    fontWeight: 600,
  },
  logoutBtn: {
    borderRadius: "999px",
    padding: "7px 14px",
    border: "none",
    background: "#ef4444",
    color: "#fff",
    fontSize: "13px",
    cursor: "pointer",
  },
};
