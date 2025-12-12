// src/pages/Scanner.jsx
import { useRef, useState } from "react";
import NavBar from "../components/NavBar";
import { scanURL, scanQR } from "../api/detector";
import Webcam from "react-webcam";

export default function Scanner() {
  const [rawUrl, setRawUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [decodedText, setDecodedText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Webcam state
  const webcamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  async function handleScanUrl() {
    setError("");
    setResult(null);
    setDecodedText("");

    try {
      const data = await scanURL(rawUrl);
      setResult(data);
    } catch (e) {
      console.error(e);
      setError("Failed to scan URL. Is Django running?");
    }
  }

  async function handleScanFile() {
    setError("");
    setResult(null);
    setDecodedText("");

    if (!selectedFile) {
      setError("Please choose a QR image file first.");
      return;
    }

    try {
      const data = await scanQR(selectedFile);
      setDecodedText(data.decoded_payload || "");
      setResult(data);
    } catch (e) {
      console.error(e);
      setError("Failed to scan QR image.");
    }
  }

  // Convert webcam screenshot (dataURL) -> File
  function dataUrlToFile(dataUrl, filename) {
    const arr = dataUrl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  async function handleCaptureAndScan() {
    setError("");
    setResult(null);
    setDecodedText("");
    setIsCapturing(true);

    try {
      const screenshot = webcamRef.current?.getScreenshot();
      if (!screenshot) {
        setError("Could not capture image. Please allow camera permission.");
        setIsCapturing(false);
        return;
      }

      setCapturedPreview(screenshot);

      // Turn captured frame into file and reuse existing scanQR()
      const file = dataUrlToFile(screenshot, "webcam_qr.jpg");
      const data = await scanQR(file);

      setDecodedText(data.decoded_payload || "");
      setResult(data);
    } catch (e) {
      console.error(e);
      setError("Failed to capture/scan from webcam.");
    } finally {
      setIsCapturing(false);
    }
  }

  const prediction = result?.prediction?.toUpperCase?.() || "";
  const fraudProb =
    typeof result?.fraud_probability === "number"
      ? result.fraud_probability.toFixed(3)
      : "";
  const genuineProb =
    typeof result?.genuine_probability === "number"
      ? result.genuine_probability.toFixed(3)
      : "";

  return (
    <div style={styles.page}>
      <NavBar />

      <main style={styles.main}>
        <section style={styles.card}>
          <h1 style={styles.h1}>UPI Fraud Detector</h1>
          <p style={styles.p}>
            Paste UPI links or upload/scan QR codes to check for fraud before paying.
          </p>

          {/* URL scan */}
          <div style={styles.block}>
            <h3 style={styles.h3}>1. Paste UPI Link / URL</h3>
            <input
              style={styles.input}
              value={rawUrl}
              onChange={(e) => setRawUrl(e.target.value)}
              placeholder="upi://pay?pa=... OR https://..."
            />
            <button style={styles.btn} onClick={handleScanUrl}>
              Scan URL
            </button>
          </div>

          {/* Upload QR */}
          <div style={styles.block}>
            <h3 style={styles.h3}>2. Or Upload QR Image</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                style={styles.btnAlt}
              />
              <button style={styles.btnGreen} onClick={handleScanFile}>
                Scan QR Image
              </button>
            </div>
          </div>

          {/* Webcam QR */}
          <div style={styles.block}>
            <h3 style={styles.h3}>3. Live Webcam QR Scan</h3>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                style={styles.btnAlt}
                onClick={() => setCameraOn((v) => !v)}
              >
                {cameraOn ? "Turn Off Camera" : "Turn On Camera"}
              </button>

              <button
                style={{
                  ...styles.btn,
                  opacity: cameraOn ? 1 : 0.5,
                  cursor: cameraOn ? "pointer" : "not-allowed",
                }}
                disabled={!cameraOn || isCapturing}
                onClick={handleCaptureAndScan}
              >
                {isCapturing ? "Capturing..." : "Capture & Scan"}
              </button>
            </div>

            {cameraOn && (
              <div style={styles.webcamWrap}>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{
                    facingMode: "environment", // uses back camera on phones (if supported)
                  }}
                  style={styles.webcam}
                />
              </div>
            )}

            {capturedPreview && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.smallLabel}>Captured Preview</div>
                <img
                  src={capturedPreview}
                  alt="Captured"
                  style={styles.preview}
                />
              </div>
            )}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {/* Result box */}
          {result && (
            <div style={styles.resultBox}>
              <div style={styles.prediction}>{prediction}</div>
              <div style={styles.metric}>Fraud Probability: {fraudProb}</div>
              <div style={styles.metric}>Genuine Probability: {genuineProb}</div>

              {decodedText && (
                <div style={{ marginTop: 10 }}>
                  <div style={styles.smallLabel}>Decoded from QR:</div>
                  <div style={styles.decoded}>{decodedText}</div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", color: "#e5e7eb" },
  main: { maxWidth: 1180, margin: "0 auto", padding: 20 },
  card: {
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(148,163,184,0.35)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 24px 60px rgba(15,23,42,0.9)",
  },
  h1: { margin: 0, fontSize: 22 },
  p: { marginTop: 6, color: "#94a3b8", fontSize: 13 },
  h3: { margin: "0 0 10px", fontSize: 14 },
  block: { marginTop: 18 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    outline: "none",
  },
  btn: {
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(99,102,241,0.5)",
    background: "linear-gradient(135deg,#4f46e5,#06b6d4)",
    color: "#0b1220",
    fontWeight: 700,
  },
  btnGreen: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "linear-gradient(135deg,#22c55e,#14b8a6)",
    color: "#052e16",
    fontWeight: 700,
  },
  btnAlt: {
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    fontWeight: 600,
  },
  webcamWrap: {
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.35)",
    maxWidth: 520,
  },
  webcam: { width: "100%", display: "block" },
  preview: {
    width: "100%",
    maxWidth: 260,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.35)",
  },
  resultBox: {
    marginTop: 18,
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(2,6,23,0.55)",
    borderRadius: 16,
    padding: 16,
  },
  prediction: { fontSize: 16, fontWeight: 800, color: "#22c55e" },
  metric: { marginTop: 6, fontSize: 13, color: "#e5e7eb" },
  decoded: { marginTop: 6, fontSize: 13, color: "#cbd5e1" },
  smallLabel: { fontSize: 12, color: "#94a3b8" },
  error: { marginTop: 14, color: "#fb923c", fontSize: 13 },
};
