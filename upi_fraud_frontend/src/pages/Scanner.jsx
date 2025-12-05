// src/pages/Scanner.jsx
import { useState } from "react";
import NavBar from "../components/NavBar";
import { scanURL, scanQR } from "../api/detector";
import ResultCard from "../components/ResultCard";

export default function Scanner() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [decodedText, setDecodedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleScanUrl() {
    setError("");
    if (!url.trim()) {
      setError("Please paste a UPI or website link.");
      return;
    }
    try {
      setLoading(true);
      const data = await scanURL(url.trim());
      setResult(data);
      setDecodedText(""); // URL mode uses raw_url only
    } catch (err) {
      console.error(err);
      setError("Failed to scan URL. Is Django running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleScanQR() {
    setError("");
    if (!file) {
      setError("Please choose a QR image first.");
      return;
    }
    try {
      setLoading(true);
      const data = await scanQR(file);
      setDecodedText(data.decoded_payload || "");
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to decode QR. Check the image quality.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <NavBar />

      <main style={styles.main}>
        <div style={styles.leftColumn}>
          <h1 style={styles.heading}>UPI Fraud Detector</h1>
          <p style={styles.subheading}>
            Paste a UPI payment link or upload a QR image to check if it’s
            genuine, suspicious, or fraud <span>before</span> you pay.
          </p>

          <section style={styles.card}>
            <p style={styles.sectionLabel}>1. Paste UPI Link / URL</p>
            <div style={styles.inputRow}>
              <input
                style={styles.input}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="upi://pay?pa=abcd@okaxis&am=500 or https://paytm.com/recharge?amount=500"
              />
              <button
                style={styles.primaryBtn}
                onClick={handleScanUrl}
                disabled={loading}
              >
                {loading ? "Scanning..." : "Scan URL"}
              </button>
            </div>
          </section>

          <section style={styles.card}>
            <p style={styles.sectionLabel}>2. Or Upload QR Image</p>
            <div style={styles.qrRow}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
              <button
                style={styles.secondaryBtn}
                onClick={handleScanQR}
                disabled={loading}
              >
                {loading ? "Scanning..." : "Scan QR Image"}
              </button>
            </div>
            {decodedText && (
              <p style={styles.decoded}>
                <strong>Decoded from QR:</strong> {decodedText}
              </p>
            )}
          </section>

          {error && <div style={styles.error}>{error}</div>}
        </div>

        <div style={styles.rightColumn}>
          {result ? (
            <ResultCard data={result} />
          ) : (
            <div style={styles.placeholderCard}>
              <p style={styles.placeholderTitle}>No scan yet</p>
              <p style={styles.placeholderText}>
                Once you scan a URL or QR, the prediction and safe payment QR
                will appear here.
              </p>
            </div>
          )}
        </div>
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
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
    gap: "24px",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  heading: {
    fontSize: "26px",
    margin: 0,
  },
  subheading: {
    fontSize: "13px",
    color: "#9ca3af",
    marginTop: "4px",
    marginBottom: "10px",
  },
  card: {
    background: "rgba(15,23,42,0.95)",
    borderRadius: "14px",
    padding: "16px 18px",
    border: "1px solid rgba(148,163,184,0.4)",
    boxShadow: "0 20px 45px rgba(15,23,42,0.9)",
  },
  sectionLabel: {
    fontSize: "13px",
    marginBottom: "10px",
    fontWeight: 500,
  },
  inputRow: {
    display: "flex",
    gap: "10px",
  },
  input: {
    flex: 1,
    padding: "9px 11px",
    borderRadius: "10px",
    border: "1px solid rgba(55,65,81,0.9)",
    backgroundColor: "#020617",
    color: "#e5e7eb",
    fontSize: "13px",
    outline: "none",
  },
  primaryBtn: {
    padding: "0 14px",
    borderRadius: "999px",
    border: "none",
    background:
      "linear-gradient(135deg, #4f46e5, #22c55e)",
    color: "#020617",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  secondaryBtn: {
    padding: "7px 14px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.4)",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: "13px",
  },
  qrRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  decoded: {
    marginTop: "10px",
    fontSize: "12px",
    color: "#9ca3af",
    wordBreak: "break-all",
  },
  error: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#f97316",
  },
  rightColumn: {
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
  },
  placeholderCard: {
    alignSelf: "stretch",
    background: "rgba(15,23,42,0.85)",
    borderRadius: "14px",
    padding: "18px 20px",
    border: "1px dashed rgba(148,163,184,0.5)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  placeholderTitle: {
    fontSize: "16px",
    marginBottom: "6px",
  },
  placeholderText: {
    fontSize: "13px",
    color: "#9ca3af",
  },
};
