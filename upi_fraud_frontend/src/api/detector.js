const API_BASE = "http://127.0.0.1:8000";

export async function scanURL(raw_url) {
  const res = await fetch(`${API_BASE}/api/predict-url/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_url }),
  });

  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return await res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/api/stats/`);
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return await res.json();
}

export async function scanQR(file) {
  const formData = new FormData();
  formData.append("qr_image", file);

  const res = await fetch(`${API_BASE}/api/decode-qr/`, {
    method: "POST",
    body: formData, // no Content-Type header; browser sets boundary
  });

  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return await res.json(); // { decoded_payload, prediction, fraud_probability, genuine_probability }
}
export async function getHistory(limit = 50) {
  const res = await fetch(
    `http://127.0.0.1:8000/api/history/?limit=${limit}`
  );

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`);
  }

  return await res.json(); // { results: [...] }
}
