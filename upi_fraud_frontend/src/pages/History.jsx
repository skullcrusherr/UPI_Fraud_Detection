// src/pages/History.jsx
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import { getHistory } from "../api/detector";

export default function History() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadHistory() {
    try {
      setLoading(true);
      setError("");
      const data = await getHistory(50);
      setRows(data.results || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load history. Is Django running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div style={styles.page}>
      <NavBar />

      <main style={styles.main}>
        <section style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <h2 style={styles.title}>Scan History</h2>
              <p style={styles.subtitle}>
                Latest scans with prediction and probabilities.
              </p>
            </div>
            <button style={styles.refreshBtn} onClick={loadHistory}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.tableWrapper}>
            {rows.length === 0 && !loading ? (
              <p style={styles.placeholder}>No scans yet.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Link / Payload</th>
                    <th style={styles.th}>Prediction</th>
                    <th style={styles.th}>Fraud</th>
                    <th style={styles.th}>Genuine</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>
                        {row.timestamp
                          ? new Date(row.timestamp).toLocaleString()
                          : "-"}
                      </td>
                      <td style={{ ...styles.td, maxWidth: "360px" }}>
                        <span style={styles.mono}>
                          {row.raw_url ||
                            row.url_text ||
                            row.decoded_payload ||
                            "-"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={predictionStyle(row.prediction)}>
                          {row.prediction?.toUpperCase() || "-"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {row.fraud_probability !== undefined
                          ? row.fraud_probability.toFixed(3)
                          : "-"}
                      </td>
                      <td style={styles.td}>
                        {row.genuine_probability !== undefined
                          ? row.genuine_probability.toFixed(3)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    color: "#e5e7eb",
  },
  main: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "20px",
  },
  card: {
    background: "rgba(15,23,42,0.95)",
    borderRadius: "18px",
    padding: "18px 20px 20px",
    border: "1px solid rgba(148,163,184,0.4)",
    boxShadow: "0 24px 60px rgba(15,23,42,0.9)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "10px",
  },
  title: {
    margin: 0,
    fontSize: "20px",
  },
  subtitle: {
    margin: 0,
    marginTop: "4px",
    fontSize: "13px",
    color: "#9ca3af",
  },
  refreshBtn: {
    padding: "7px 14px",
    borderRadius: "999px",
    border: "none",
    background:
      "linear-gradient(135deg, #4f46e5, #22c55e)",
    color: "#020617",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    fontSize: "13px",
    color: "#f97316",
    marginBottom: "8px",
  },
  tableWrapper: {
    marginTop: "8px",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    textAlign: "left",
    padding: "8px",
    borderBottom: "1px solid #1f2937",
    color: "#9ca3af",
    fontWeight: 500,
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #111827",
    verticalAlign: "top",
  },
  mono: {
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  placeholder: {
    fontSize: "13px",
    color: "#9ca3af",
  },
};

function predictionStyle(pred) {
  if (pred === "fraud") {
    return { color: "#ef4444", fontWeight: 600 };
  }
  if (pred === "suspicious") {
    return { color: "#f59e0b", fontWeight: 600 };
  }
  if (pred === "genuine") {
    return { color: "#22c55e", fontWeight: 600 };
  }
  return {};
}
