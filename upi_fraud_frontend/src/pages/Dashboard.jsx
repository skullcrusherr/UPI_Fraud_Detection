// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import { getStats } from "../api/detector";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getStats();
        console.log("Stats from backend:", data);
        setStats(data);
      } catch (err) {
        console.error(err);
        setError("Could not load stats. Is Django running?");
      }
    }
    load();
  }, []);

  const COLORS = ["#ef4444", "#22c55e", "#f59e0b"];

  // Safely read values from either:
  // { fraud_count, genuine_count, suspicious_count }
  // OR { fraud, genuine, suspicious }
  const fraud =
    stats != null
      ? stats.fraud_count ?? stats.fraud ?? 0
      : 0;
  const genuine =
    stats != null
      ? stats.genuine_count ?? stats.genuine ?? 0
      : 0;
  const suspicious =
    stats != null
      ? stats.suspicious_count ?? stats.suspicious ?? 0
      : 0;

  const total = fraud + genuine + suspicious;

  const chartData = [
    { name: "Fraud", value: fraud },
    { name: "Genuine", value: genuine },
    { name: "Suspicious", value: suspicious },
  ];

  return (
    <div style={styles.page}>
      <NavBar />

      <main style={styles.main}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.title}>Scan Statistics</h2>
              <p style={styles.subtitle}>
                Overall breakdown of fraud vs genuine vs suspicious scans.
              </p>
            </div>
            {total > 0 && (
              <span style={styles.totalBadge}>{total} total scans</span>
            )}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {!error && (
            <div style={styles.chartRow}>
              <div style={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>

                {total === 0 && (
                  <p style={styles.placeholder}>
                    No scans recorded yet. Run a few checks on the Scanner page
                    to populate these stats.
                  </p>
                )}
              </div>

              <div style={styles.summary}>
                <h3 style={styles.summaryTitle}>Summary</h3>
                <ul style={styles.summaryList}>
                  <li>
                    <span style={styles.dot("#ef4444")} />
                    Fraud: <strong>{fraud}</strong>
                  </li>
                  <li>
                    <span style={styles.dot("#22c55e")} />
                    Genuine: <strong>{genuine}</strong>
                  </li>
                  <li>
                    <span style={styles.dot("#f59e0b")} />
                    Suspicious: <strong>{suspicious}</strong>
                  </li>
                </ul>
              </div>
            </div>
          )}
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
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    gap: "12px",
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
  totalBadge: {
    fontSize: "12px",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #4f46e5, #22c55e)",
    color: "#020617",
    fontWeight: 600,
  },
  chartRow: {
    marginTop: "12px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
    gap: "20px",
  },
  chartContainer: {
    minHeight: "260px",
  },
  summary: {
    fontSize: "13px",
    color: "#e5e7eb",
  },
  summaryTitle: {
    marginTop: 0,
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 600,
  },
  summaryList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  dot: (color) => ({
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: color,
    marginRight: "6px",
  }),
  placeholder: {
    fontSize: "13px",
    color: "#9ca3af",
    marginTop: "12px",
    textAlign: "center",
  },
  error: {
    fontSize: "13px",
    color: "#f97316",
  },
};
