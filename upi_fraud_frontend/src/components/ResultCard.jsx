import { useState } from "react";
import QRCode from "react-qr-code";

//
// 🔍 Extract ONLY the real URL (http/https/upi) from messy strings
// Example: "48 https://imdb.com Name: url, dtype: object"
// → returns "https://imdb.com"
//
function extractCoreUrl(text = "") {
  if (!text || typeof text !== "string") return "";

  const match = text.match(/((https?|upi):\/\/[^\s]+)/i);
  if (match) {
    return match[1].trim();
  }

  return text.trim();
}

export default function ResultCard({ data }) {
  if (!data) return null;

  const {
    prediction,
    fraud_probability,
    genuine_probability,
    decoded_payload,
    raw_url,
  } = data;

  const [showQR, setShowQR] = useState(false);

  //
  // Clean the URL BEFORE using it anywhere
  //
  const rawCombined = decoded_payload || raw_url || "";
  const urlToUse = extractCoreUrl(rawCombined);

  const isFraud = prediction === "fraud";
  const isGenuine = prediction === "genuine";
  const isSuspicious = prediction === "suspicious";

  const boxColor = isFraud
    ? "#8b0000"
    : isSuspicious
    ? "#b8860b"
    : "#006400";

  //
  // Open URL safely (only if valid)
  //
  const handleSafeOpen = () => {
    if (!urlToUse) {
      alert("Cannot open: URL is invalid");
      return;
    }

    window.open(urlToUse, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        marginTop: "20px",
        border: `2px solid ${boxColor}`,
        padding: "20px",
        borderRadius: "8px",
        width: "350px",
        color: "#fff",
      }}
    >
      <h3 style={{ color: boxColor }}>
        {isFraud && "⚠️ FRAUD DETECTED"}
        {isGenuine && "✔️ GENUINE"}
        {isSuspicious && "⚠️ SUSPICIOUS"}
      </h3>

      <p>Fraud Probability: {fraud_probability.toFixed(3)}</p>
      <p>Genuine Probability: {genuine_probability.toFixed(3)}</p>

      {/* Cleaned URL shown */}
      {(decoded_payload || raw_url) && (
        <p style={{ fontSize: "14px", marginTop: "10px", opacity: 0.9 }}>
          <strong>Decoded Link:</strong> {urlToUse}
        </p>
      )}

      {/* SAFETY BUTTON */}
      {urlToUse && (
        <button
          onClick={handleSafeOpen}
          style={{
            marginTop: "15px",
            padding: "10px 15px",
            backgroundColor: "#4a4eff",
            border: "none",
            color: "white",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Open Link Safely
        </button>
      )}

      {/* QR Toggle */}
      <button
        onClick={() => setShowQR(!showQR)}
        style={{
          marginTop: "10px",
          padding: "8px 12px",
          backgroundColor: "#008080",
          border: "none",
          color: "white",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        {showQR ? "Hide QR" : "Show QR"}
      </button>

      {/* QR Code */}
      {showQR && urlToUse && (
        <div style={{ background: "#fff", padding: "10px", marginTop: "15px" }}>
          <QRCode value={urlToUse} size={200} />
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    borderWidth: "2px",
    borderStyle: "solid",
    padding: "20px",
    marginTop: "20px",
    borderRadius: "8px",
    color: "white",
    background: "#020617",
  },
  title: {
    fontSize: "18px",
    marginBottom: "8px",
  },
  payload: {
    marginTop: "10px",
    fontSize: "14px",
    wordBreak: "break-all",
  },
  buttonRow: {
    display: "flex",
    gap: "10px",
    marginTop: "16px",
    flexWrap: "wrap",
  },
  safeBtn: {
    padding: "10px 16px",
    background: "#2563eb",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
    fontSize: "14px",
  },
  qrBtn: {
    padding: "10px 16px",
    background: "#10b981",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
    fontSize: "14px",
  },
  qrBox: {
    marginTop: "16px",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #1f2937",
    background: "#020617",
    maxWidth: "260px",
  },
  qrText: {
    fontSize: "13px",
    marginBottom: "8px",
    color: "#9ca3af",
  },
  qrInner: {
    background: "white",
    padding: "8px",
    borderRadius: "8px",
    display: "inline-block",
  },
  warning: {
    marginTop: "16px",
    color: "#f59e0b",
    fontSize: "14px",
  },
  danger: {
    marginTop: "16px",
    color: "#dc2626",
    fontSize: "14px",
  },
};
