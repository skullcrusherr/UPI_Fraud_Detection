// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api/auth.js"; // whatever you named your auth helpers

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let res;
      if (mode === "login") {
        res = await login(email, password);
      } else {
        res = await register(email, password);
      }

      if (res && res.token) {
        localStorage.setItem("upi_token", res.token);
        navigate("/scanner");
      } else {
        setError(res?.detail || "Unexpected response from server");
      }
    } catch (err) {
      console.error(err);
      setError("Request failed. Is the Django server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>UPI Guard</div>
        <h1 style={styles.title}>
          Smart UPI Fraud <span style={styles.highlight}>Detection</span>
        </h1>
        <p style={styles.subtitle}>
          Log in to scan payment links and QR codes before paying.
        </p>

        <div style={styles.toggleRow}>
          <button
            style={{
              ...styles.toggleBtn,
              ...(mode === "login" ? styles.toggleActive : {}),
            }}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            style={{
              ...styles.toggleBtn,
              ...(mode === "register" ? styles.toggleActive : {}),
            }}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <form style={styles.form} onSubmit={handleSubmit}>
          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            style={styles.submitBtn}
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Create account"}
          </button>
        </form>
      </div>
    </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  card: {
    width: "100%",
    minHeight: "450px",
    background: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(8px)",
    borderRadius: "20px",
    padding: "30px",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
  },
  badge: {
    display: "inline-block",
    fontSize: "11px",
    padding: "4px 9px",
    borderRadius: "999px",
    background:
      "linear-gradient(135deg, #4f46e5, #22c55e)",
    color: "#020617",
    fontWeight: 600,
    marginBottom: "12px",
  },
  title: {
    fontSize: "24px",
    margin: 0,
    marginBottom: "8px",
  },
  highlight: {
    backgroundImage: "linear-gradient(135deg, #f97316, #22c55e)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },
  subtitle: {
    fontSize: "13px",
    color: "#9ca3af",
    marginBottom: "18px",
  },
  toggleRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  toggleBtn: {
    flex: 1,
    fontSize: "13px",
    padding: "7px 0",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.4)",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  toggleActive: {
    background:
      "linear-gradient(135deg, #4f46e5, #22c55e)",
    color: "#020617",
    borderColor: "transparent",
    fontWeight: 600,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  label: {
    fontSize: "12px",
    color: "#9ca3af",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  input: {
    padding: "9px 11px",
    borderRadius: "8px",
    border: "1px solid rgba(55,65,81,0.9)",
    backgroundColor: "#020617",
    color: "#e5e7eb",
    fontSize: "13px",
    outline: "none",
  },
  error: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#f97316",
  },
  submitBtn: {
    marginTop: "6px",
    padding: "10px 0",
    borderRadius: "999px",
    border: "none",
    background:
      "linear-gradient(135deg, #4f46e5, #22c55e)",
    color: "#020617",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
  },
};
