// src/pages/Scanner.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import NavBar from "../components/NavBar";
import { scanURL, scanQR, evaluateUpi } from "../api/detector";
import Webcam from "react-webcam";
import { QRCodeCanvas } from "qrcode.react";

const SAFE_OPEN_ALLOWED = ["genuine"]; // only allow direct open when verdict is genuine

function isUpiLink(s) {
  return typeof s === "string" && s.trim().toLowerCase().startsWith("upi://");
}

function parseUpi(link) {
  // minimal client-side parser for UI only (backend does the real parsing)
  // supports: upi://pay?pa=...&pn=...&am=...&cu=...
  try {
    const trimmed = (link || "").trim();
    if (!trimmed.toLowerCase().startsWith("upi://")) return null;

    const qIndex = trimmed.indexOf("?");
    const query = qIndex >= 0 ? trimmed.slice(qIndex + 1) : "";
    const params = new URLSearchParams(query);

    const pa = params.get("pa") || "";
    const pn = params.get("pn") ? decodeURIComponent(params.get("pn")) : "";
    const am = params.get("am") || "";
    const cu = params.get("cu") || "";
    const tn = params.get("tn") ? decodeURIComponent(params.get("tn")) : "";
    const mode = params.get("mode") || "";
    const orgid = params.get("orgid") || "";

    return { pa, pn, am, cu, tn, mode, orgid, is_upi: true };
  } catch {
    return null;
  }
}

export default function Scanner() {
  // URL / QR input
  const [rawUrl, setRawUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  // outputs
  const [decodedText, setDecodedText] = useState("");
  const [result, setResult] = useState(null);      // from /predict-url or /decode-qr
  const [upiEval, setUpiEval] = useState(null);    // from /upi-evaluate
  const [error, setError] = useState("");

  // webcam
  const webcamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // UPI context inputs (Option B: backend-valid values)
  const [expectedVpa, setExpectedVpa] = useState("");
  const [expectedName, setExpectedName] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");

  // IMPORTANT: use backend choices exactly
  const [intent, setIntent] = useState("unknown"); // merchant_payment, personal_transfer, refund, prize_cashback, unknown
  const [source, setSource] = useState("unknown"); // printed_shop_qr, website_checkout, whatsapp_telegram, sms, unknown

  // user signal (frontend-only, not sent to serializer)
  const [userConfirmedTrusted, setUserConfirmedTrusted] = useState(false);

  // scam checkbox maps to backend scam_checkbox
  const [scamCheckbox, setScamCheckbox] = useState(false);

  // show QR code for safe link
  const [showQr, setShowQr] = useState(false);

  function resetAllOutputs() {
    setError("");
    setResult(null);
    setUpiEval(null);
    setDecodedText("");
    setShowQr(false);
  }

  // derive detected link (either decoded payload, or raw url)
  const detectedLink = useMemo(() => {
    if (decodedText?.trim()) return decodedText.trim();
    if (result?.decoded_payload?.trim()) return result.decoded_payload.trim();
    if (rawUrl?.trim()) return rawUrl.trim();
    return "";
  }, [decodedText, result, rawUrl]);

  const upiParts = useMemo(() => parseUpi(detectedLink), [detectedLink]);
  const isUpiDetected = !!upiParts;

  // cleanup webcam properly when toggled off/unmount
  useEffect(() => {
    if (!cameraOn) {
      setCapturedPreview(null);
      // stop camera tracks if any
      const stream = webcamRef.current?.stream;
      if (stream?.getTracks) {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
  }, [cameraOn]);

  async function handleScanUrl() {
    resetAllOutputs();

    const val = rawUrl.trim();
    if (!val) {
      setError("Please paste a URL/UPI link first.");
      return;
    }

    try {
      const data = await scanURL(val);
      setResult(data);
      // If user scanned a UPI link, let them see QR / open options too
      setShowQr(true);
    } catch (e) {
      console.error(e);
      setError(`Failed to scan URL: ${e?.message || "Unknown error"}`);
    }
  }

  async function handleScanFile() {
    resetAllOutputs();

    if (!selectedFile) {
      setError("Please choose a QR image file first.");
      return;
    }

    try {
      const data = await scanQR(selectedFile);
      setDecodedText(data.decoded_payload || "");
      setResult(data);
      setShowQr(true);
    } catch (e) {
      console.error(e);
      setError(`Failed to scan QR image: ${e?.message || "Unknown error"}`);
    }
  }

  async function dataUrlToFile(dataUrl, filename) {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  }

  async function handleCaptureAndScan() {
    resetAllOutputs();
    if (!cameraOn) {
      setError("Turn on camera first.");
      return;
    }

    setIsCapturing(true);
    try {
      const screenshot = webcamRef.current?.getScreenshot();
      if (!screenshot) {
        setError("Could not capture image. Please allow camera permission.");
        return;
      }

      setCapturedPreview(screenshot);

      const file = await dataUrlToFile(screenshot, "webcam_qr.jpg");
      const data = await scanQR(file);

      setDecodedText(data.decoded_payload || "");
      setResult(data);
      setShowQr(true);
    } catch (e) {
      console.error(e);
      setError(`Failed to capture/scan from webcam: ${e?.message || "Unknown error"}`);
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleEvaluateUpi() {
    setError("");
    setUpiEval(null);

    if (!isUpiDetected) {
      setError("No UPI deep link detected. Paste/scan a upi://pay link first.");
      return;
    }

    try {
      // must match backend serializer keys exactly:
      // raw_url, expected_vpa, expected_name, expected_amount, intent, source, scam_checkbox
      const payload = {
        raw_url: detectedLink,
        expected_vpa: expectedVpa || "",
        expected_name: expectedName || "",
        expected_amount: expectedAmount || "",
        intent,              // backend-valid
        source,              // backend-valid
        scam_checkbox: !!scamCheckbox,
      };

      const data = await evaluateUpi(payload);
      setUpiEval(data);
    } catch (e) {
      console.error(e);
      setError(`UPI evaluate failed: ${e?.message || "Unknown error"}`);
    }
  }

  const finalLabel = useMemo(() => {
    // Prefer upi-eval decision; fallback to ML result prediction
    const v = upiEval?.final_decision || upiEval?.prediction || result?.prediction || "";
    return String(v).toLowerCase();
  }, [upiEval, result]);

  const fraudProb = useMemo(() => {
    const p = upiEval?.fraud_probability ?? result?.fraud_probability;
    return typeof p === "number" ? p.toFixed(3) : "";
  }, [upiEval, result]);

  const genuineProb = useMemo(() => {
    const p = upiEval?.genuine_probability ?? result?.genuine_probability;
    return typeof p === "number" ? p.toFixed(3) : "";
  }, [upiEval, result]);

  const riskScore = useMemo(() => {
    const r = upiEval?.risk_score;
    return typeof r === "number" ? r.toFixed(3) : "";
  }, [upiEval]);

  // extra rule: if user typed expected name, and it doesn't appear even partially in pn, mark suspicious (UI hint)
  const nameMismatchHint = useMemo(() => {
    if (!isUpiDetected) return "";
    const a = (expectedName || "").trim().toLowerCase();
    const b = (upiParts?.pn || "").trim().toLowerCase();
    if (!a) return "";
    if (!b) return "Payee name (pn) is missing in the UPI link, but you entered a name.";
    const aTokens = a.split(/\s+/).filter(Boolean);
    const partialMatch = aTokens.some((t) => b.includes(t));
    return partialMatch ? "" : "Entered name does not match the Payee Name (pn) in the UPI link (even partially).";
  }, [isUpiDetected, expectedName, upiParts]);

  const canOpen = useMemo(() => {
    // allow open if:
    // - not upi: only open when model says genuine
    // - upi: only open when upi-eval final_decision says genuine
    const lbl = finalLabel;
    return SAFE_OPEN_ALLOWED.some((s) => lbl.includes(s));
  }, [finalLabel]);

  function openLinkSafely() {
    if (!canOpen) return;
    window.open(detectedLink, "_blank", "noopener,noreferrer");
  }

  const accent = finalLabel.includes("fraud")
    ? "#ef4444"
    : finalLabel.includes("genuine")
    ? "#22c55e"
    : "#f59e0b";

  const hasAnyResult = !!result || !!upiEval;

  return (
    <div style={styles.page}>
      <NavBar />

      <main style={styles.main}>
        <section style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <h1 style={styles.h1}>UPI Guard Scanner</h1>
              <p style={styles.p}>
                Scan URLs and UPI QR codes. If a UPI deep link is detected, use <b>UPI Evaluate</b> for context-aware verdicts.
              </p>
            </div>
          </div>

          {/* 1) URL scan */}
          <div style={styles.block}>
            <h3 style={styles.h3}>1) Paste URL / UPI Link</h3>
            <input
              style={styles.input}
              value={rawUrl}
              onChange={(e) => setRawUrl(e.target.value)}
              placeholder="upi://pay?pa=... OR https://..."
            />
            <div style={styles.row}>
              <button style={styles.btn} onClick={handleScanUrl}>
                Scan URL
              </button>
            </div>
          </div>

          {/* 2) Upload QR */}
          <div style={styles.block}>
            <h3 style={styles.h3}>2) Upload QR Image</h3>
            <div style={styles.rowWrap}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                style={styles.fileInput}
              />
              <button style={styles.btnGreen} onClick={handleScanFile}>
                Scan QR Image
              </button>
            </div>
            {selectedFile && (
              <div style={styles.helper}>
                Selected: <b style={{ color: "#e5e7eb" }}>{selectedFile.name}</b>
              </div>
            )}
          </div>

          {/* 3) Webcam */}
          <div style={styles.block}>
            <h3 style={styles.h3}>3) Live Webcam QR Scan</h3>

            <div style={styles.rowWrap}>
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
                  screenshotQuality={0.92}
                  videoConstraints={{ facingMode: "environment", width: 1280, height: 720 }}
                  style={styles.webcam}
                />
              </div>
            )}

            {capturedPreview && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.smallLabel}>Captured Preview</div>
                <img src={capturedPreview} alt="Captured" style={styles.preview} />
              </div>
            )}
          </div>

          {/* Detected link */}
          {!!detectedLink && (
            <div style={styles.block}>
              <h3 style={styles.h3}>Detected Link</h3>
              <div style={styles.detectedBox}>
                <div style={{ wordBreak: "break-all" }}>{detectedLink}</div>

                <div style={styles.rowWrap}>
                  <button
                    style={{
                      ...styles.btnAlt,
                      opacity: canOpen ? 1 : 0.55,
                      cursor: canOpen ? "pointer" : "not-allowed",
                    }}
                    onClick={openLinkSafely}
                    disabled={!canOpen}
                    title={canOpen ? "Open in new tab" : "Open is allowed only when verdict is GENUINE"}
                  >
                    Open URL (safe only)
                  </button>

                  <button
                    style={styles.btnAlt}
                    onClick={() => setShowQr((v) => !v)}
                  >
                    {showQr ? "Hide QR" : "Show QR"}
                  </button>
                </div>

                {showQr && (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <div style={styles.smallLabel}>QR Code for the detected link</div>
                    <div style={styles.qrWrap}>
                      <QRCodeCanvas value={detectedLink} size={180} includeMargin />
                    </div>
                    <div style={styles.helper}>
                      Tip: If this is a UPI link and verdict is genuine, you can scan it using your phone UPI app.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* UPI Evaluate panel only if UPI detected */}
          {isUpiDetected && (
            <div style={styles.block}>
              <h3 style={styles.h3}>UPI Evaluate (Context + Rule Engine)</h3>

              <div style={styles.grid2}>
                <div>
                  <div style={styles.smallLabel}>Expected Payee VPA (optional)</div>
                  <input
                    style={styles.input}
                    value={expectedVpa}
                    onChange={(e) => setExpectedVpa(e.target.value)}
                    placeholder="e.g. namith@okaxis"
                  />
                </div>

                <div>
                  <div style={styles.smallLabel}>Expected Payee Name (optional)</div>
                  <input
                    style={styles.input}
                    value={expectedName}
                    onChange={(e) => setExpectedName(e.target.value)}
                    placeholder="e.g. Vaibhavi"
                  />
                </div>

                <div>
                  <div style={styles.smallLabel}>Expected Amount (optional)</div>
                  <input
                    style={styles.input}
                    value={expectedAmount}
                    onChange={(e) => setExpectedAmount(e.target.value)}
                    placeholder="e.g. 500"
                  />
                </div>

                <div>
                  <div style={styles.smallLabel}>Intent (backend-valid)</div>
                  <select style={styles.select} value={intent} onChange={(e) => setIntent(e.target.value)}>
                    <option value="unknown">unknown</option>
                    <option value="merchant_payment">merchant_payment</option>
                    <option value="personal_transfer">personal_transfer</option>
                    <option value="refund">refund</option>
                    <option value="prize_cashback">prize_cashback</option>
                  </select>
                </div>

                <div>
                  <div style={styles.smallLabel}>Source (backend-valid)</div>
                  <select style={styles.select} value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="unknown">unknown</option>
                    <option value="sms">sms</option>
                    <option value="whatsapp_telegram">whatsapp_telegram</option>
                    <option value="website_checkout">website_checkout</option>
                    <option value="printed_shop_qr">printed_shop_qr</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={scamCheckbox}
                    onChange={(e) => setScamCheckbox(e.target.checked)}
                  />
                  <span>
                    I suspect a scam context (refund / prize / KYC / “send money to receive money”)
                  </span>
                </label>

                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={userConfirmedTrusted}
                    onChange={(e) => setUserConfirmedTrusted(e.target.checked)}
                  />
                  <span>
                    I personally trust this payee (UI hint to reduce panic, not sent to backend)
                  </span>
                </label>

                {nameMismatchHint && (
                  <div style={styles.warnHint}>
                    ⚠️ {nameMismatchHint} (This will bias the link toward <b>Suspicious</b> in human review.)
                  </div>
                )}
              </div>

              <div style={styles.rowWrap}>
                <button style={styles.btnPurple} onClick={handleEvaluateUpi}>
                  Run UPI Evaluate
                </button>
              </div>

              <div style={styles.upiInfo}>
                <div style={styles.smallLabel}>UPI parsed (client preview)</div>
                <div style={styles.infoGrid}>
                  <div><b>pa</b>: {upiParts.pa || "—"}</div>
                  <div><b>pn</b>: {upiParts.pn || "—"}</div>
                  <div><b>am</b>: {upiParts.am || "—"}</div>
                  <div><b>cu</b>: {upiParts.cu || "—"}</div>
                </div>
              </div>
            </div>
          )}

          {error && <div style={styles.error}>{error}</div>}

          {/* Result card */}
          {hasAnyResult && (
            <div style={{ ...styles.resultBox, borderColor: `${accent}66` }}>
              <div style={{ ...styles.prediction, color: accent }}>
                {(finalLabel || "").toUpperCase() || "RESULT"}
              </div>

              <div style={styles.metricsRow}>
                <div style={styles.metricChip}>Fraud: <b>{fraudProb || "—"}</b></div>
                <div style={styles.metricChip}>Genuine: <b>{genuineProb || "—"}</b></div>
                {riskScore && <div style={styles.metricChip}>Risk Score: <b>{riskScore}</b></div>}
              </div>

              {/* signals */}
              {Array.isArray(upiEval?.signals) && upiEval.signals.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.smallLabel}>Signals</div>
                  <ul style={styles.signalList}>
                    {upiEval.signals.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                    {nameMismatchHint && <li>{nameMismatchHint}</li>}
                    {userConfirmedTrusted && <li>User confirmed trust (UI context only).</li>}
                  </ul>
                </div>
              )}

              {/* QR decoded */}
              {!!decodedText && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.smallLabel}>Decoded from QR</div>
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
  headerRow: { display: "flex", justifyContent: "space-between", gap: 12 },
  h1: { margin: 0, fontSize: 22 },
  p: { marginTop: 6, color: "#94a3b8", fontSize: 13, maxWidth: 860 },

  h3: { margin: "0 0 10px", fontSize: 14 },
  block: { marginTop: 18 },

  row: { display: "flex", gap: 12, marginTop: 10 },
  rowWrap: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    outline: "none",
  },

  btn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(99,102,241,0.5)",
    background: "linear-gradient(135deg,#4f46e5,#06b6d4)",
    color: "#0b1220",
    fontWeight: 800,
  },
  btnGreen: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "linear-gradient(135deg,#22c55e,#14b8a6)",
    color: "#052e16",
    fontWeight: 800,
  },
  btnPurple: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(168,85,247,0.45)",
    background: "linear-gradient(135deg,#a855f7,#6366f1)",
    color: "#0b1220",
    fontWeight: 900,
  },
  btnAlt: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    fontWeight: 700,
  },

  fileInput: {
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

  detectedBox: {
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.55)",
    padding: 12,
  },

  qrWrap: {
    width: 200,
    height: 200,
    display: "grid",
    placeItems: "center",
    background: "white",
    borderRadius: 14,
    padding: 10,
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  checkboxRow: { display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: "#e5e7eb" },

  upiInfo: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.55)",
    padding: 12,
  },
  infoGrid: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    fontSize: 13,
    color: "#cbd5e1",
  },

  warnHint: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(245,158,11,0.45)",
    background: "rgba(245,158,11,0.10)",
    color: "#fde68a",
    fontSize: 13,
  },

  resultBox: {
    marginTop: 18,
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(2,6,23,0.55)",
    borderRadius: 16,
    padding: 16,
  },
  prediction: { fontSize: 16, fontWeight: 900 },
  metricsRow: { marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 },
  metricChip: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(2,6,23,0.5)",
    fontSize: 13,
    color: "#e5e7eb",
  },

  decoded: { marginTop: 6, fontSize: 13, color: "#cbd5e1", wordBreak: "break-all" },
  smallLabel: { fontSize: 12, color: "#94a3b8" },
  helper: { marginTop: 8, fontSize: 12, color: "#94a3b8" },
  error: { marginTop: 14, color: "#fb923c", fontSize: 13 },

  signalList: { margin: "6px 0 0", paddingLeft: 18, color: "#e5e7eb", fontSize: 13 },
};
