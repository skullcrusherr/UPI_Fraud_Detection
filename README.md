
# 🔐 UPI Guard: ML-Powered UPI URL & QR Fraud Detection Platform
**Tech Stack:** React (Vite) · Django (DRF) · Scikit-learn · MongoDB Atlas · QR Decode + Safe QR Render · Webcam Capture  
**Goal:** Detect **phishing / malicious payment URLs** and **fraud QR payloads** *before* a user proceeds to payment.

---

## 📌 Executive Summary (Manager-Friendly)
UPI Guard is an end-to-end security gateway for UPI workflows. It performs **real-time classification** of:
- **UPI deep links** (e.g., `upi://pay?...`)
- **web URLs** used in UPI scams (bonus claims, KYC traps, fake rewards, redirect pages)
- **QR codes** that encode UPI or URL payloads

The system blocks or flags malicious attempts using a trained **ML classifier**, records scan telemetry in **MongoDB Atlas**, and provides a **dashboard + scan history** for visibility.  

---

## ✨ Key Features
### 1) URL Fraud Detection (UPI links + web links)
- Input a raw URL (including `upi://` deep links).
- Server returns:
  - `prediction`: **genuine** | **suspicious** | **fraud**
  - `fraud_probability` and `genuine_probability`
- Threshold-based triage:
  - **fraud**: high confidence malicious
  - **suspicious**: borderline risk (user warning)
  - **genuine**: safe to proceed

### 2) QR Code Scan (Upload + Live Webcam)
- Upload QR image **OR**
- Use **live webcam** + “Capture & Scan”
- Backend:
  - decodes QR payload
  - runs ML classification on extracted payload
  - returns decoded payload + prediction + probabilities

### 3) Safe QR Generation for Trusted Payloads
Because payment finalization typically happens on phone apps, the UI generates a **fresh QR code** only when the payload is **safe**:
- “✅ Safe: Scan this QR to pay”  
This ensures users scan only after a security check is completed.

### 4) Scan History + Audit Trail (MongoDB Atlas)
Every scan (URL / decoded QR payload) is logged in MongoDB:
- timestamp
- raw_url / decoded payload
- prediction + probabilities

### 5) Dashboard Analytics (Pie Chart)
A dedicated dashboard provides:
- genuine count
- suspicious count
- fraud count
Visualized via **Recharts PieChart** to quickly assess threat distribution.

### 6) Modern UI / UX
- Full-page responsive layout
- Global background + overlay for readability
- Navigation: Scanner · Dashboard · History
- Clear pre-payment security workflow (warn/block before redirect)

---

## 🧠 Machine Learning (Technical Details)
### Model Type
- **TF-IDF Vectorizer** on URL strings
- **RandomForestClassifier** (scikit-learn)

### Why TF-IDF on URLs?
URLs contain strong lexical patterns that indicate phishing:
- suspicious tokens: `bonus`, `claim`, `kyc`, `verify`, `reward`, `free`, `support`, etc.
- domain structure anomalies: long subdomains, random paths, uncommon TLDs
- query patterns: repeated parameters, misleading brands, etc.

TF-IDF captures these patterns without needing full page content fetch (safer + faster).

### Output Labels
- `genuine`
- `fraud`
- optional UI-level `suspicious` band using thresholds

### Probability Thresholding (Policy Layer)
Rather than relying solely on `argmax`, the app applies a **policy decision layer**:
- `fraud_p >= FRAUD_HARD_THRESHOLD` → **fraud**
- `FRAUD_SOFT_THRESHOLD <= fraud_p < hard` → **suspicious**
- `< soft` → **genuine**

This allows tuning for **high precision** (minimizing false alarms) while still surfacing borderline threats.

---

## 📚 Datasets Used (Training)
Multiple datasets were merged and normalized into a unified schema:
- `balanced_urls.csv`
- `malicious_phish.csv`
- `PhiUSIIL_Phishing_URL_Dataset.csv`

Each dataset is mapped into:
- `url_text`
- `label` in `{genuine, fraud}`

> Note: In production, datasets should remain out of git history or tracked using Git LFS.

---

## 🏗️ Architecture Overview
### High-Level System Flow
1. User enters URL OR scans QR (upload/webcam)
2. React sends request to Django API
3. Django calls ML classifier (in-memory model)
4. Django logs scan into MongoDB Atlas
5. Response returned to UI:
   - verdict + probabilities + decoded payload (if QR)
6. UI either:
   - blocks (fraud)
   - warns (suspicious)
   - shows “safe QR for payment” (genuine)

### Architecture Diagram (Text)
```
Browser (React/Vite)
   |  POST /api/predict-url/   POST /api/decode-qr/
   v
Django REST API (DRF)
   |--> ML Inference (TF-IDF + RF)  [local model file: models/upi_url_model.pkl]
   |
   |--> MongoDB Atlas Logging (scan_logs)
   v
Response JSON (verdict + probabilities + timestamps)
```

---

## 🧩 Backend (Django + DRF)
### Core Responsibilities
- Load ML model at startup (`joblib.load`)
- Provide REST endpoints:
  - URL classification
  - QR decode + classification
  - stats aggregation
  - scan history retrieval
- Write logs to MongoDB Atlas
- Fallback “NO-DB mode” when DB is unreachable (app still predicts)

### REST API Endpoints
#### 1) Predict URL
**POST** `/api/predict-url/`  
Request:
```json
{ "raw_url": "upi://pay?pa=abc@oksbi&am=500&tn=Test" }
```
Response:
```json
{
  "prediction": "genuine",
  "fraud_probability": 0.0123,
  "genuine_probability": 0.9877
}
```

#### 2) Decode QR + Predict
**POST** `/api/decode-qr/` (multipart/form-data)  
Field: `qr_image`  
Response:
```json
{
  "decoded_payload": "upi://pay?pa=...",
  "prediction": "suspicious",
  "fraud_probability": 0.61,
  "genuine_probability": 0.39
}
```

#### 3) History
**GET** `/api/history/?limit=50`  
Response:
```json
{
  "results": [
    {
      "raw_url": "https://example.com",
      "prediction": "fraud",
      "fraud_probability": 0.91,
      "genuine_probability": 0.09,
      "timestamp": "2025-12-05T09:48:25.487000"
    }
  ]
}
```

#### 4) Stats
**GET** `/api/stats/`  
Response:
```json
{
  "fraud_count": 12,
  "genuine_count": 31,
  "suspicious_count": 7
}
```

---

## 🗃️ Database (MongoDB Atlas)
### Collection
- Database: `urlfrauddetection`
- Collection: `scan_logs`

### Document Schema
```json
{
  "raw_url": "string",
  "prediction": "fraud|genuine|suspicious",
  "fraud_probability": "float",
  "genuine_probability": "float",
  "timestamp": "ISODate"
}
```

### Operational Notes
- MongoDB Atlas requires:
  - IP allowlisting in **Network Access**
  - valid credentials
  - TLS handshake support (PyMongo uses TLS by default for Atlas)

---

## ⚛️ Frontend (React + Vite)
### Pages
- **Login**: lightweight auth layer (can be extended to JWT / sessions)
- **Scanner**: URL scan + upload QR + webcam capture scan
- **Dashboard**: stats + pie chart visualization
- **History**: paginated list of recent scans

### Frontend Libraries
- `recharts` (PieChart)
- `react-webcam` (live webcam capture)
- `qrcode.react` (safe QR generation)

### Frontend → Backend Integration
All calls go to:
- `http://127.0.0.1:8000/api/...`

Recommended: centralize API base in an `.env` file later:
- `VITE_API_BASE=http://127.0.0.1:8000`

---

## 🧪 Local Development (Step-by-Step)
### Backend
1. `cd upi_fraud_ml`
2. `python3 -m venv venv`
3. `source venv/bin/activate`
4. `pip install -r requirements.txt`
5. `python manage.py runserver`

Backend runs at: `http://127.0.0.1:8000`

### Frontend
1. `cd upi_fraud_frontend`
2. `npm install`
3. `npm run dev`

Frontend runs at: `http://localhost:5173`

---

## ✅ Quick Test Commands
### URL prediction
```bash
curl -X POST http://127.0.0.1:8000/api/predict-url/ \
  -H "Content-Type: application/json" \
  -d '{"raw_url":"https://paytm.com/recharge?amount=500"}'
```

### History
```bash
curl http://127.0.0.1:8000/api/history/?limit=10
```

---

## 🔒 Security Notes (What This Protects Against)
- Obvious phishing URLs and “reward/bonus/KYC” traps
- Suspicious domains mimicking real brands
- QR payloads encoding phishing URLs or malicious UPI links
- Pre-payment prevention: classification happens BEFORE user proceeds

---

## ⚠️ Known Limitations (Honest Engineering Notes)
- ML is lexical-based; it doesn’t fetch webpage content (intentional for safety + speed)
- Novel scams may require retraining / new dataset refresh
- URL shorteners can reduce signal (can be handled via expansion service in future)
- Production-grade auth should use JWT + refresh tokens + role access

---

## 🧭 Roadmap / Enhancements
- JWT authentication (access + refresh)
- Rate-limiting + IP-based abuse detection
- URL expansion (bit.ly, tinyurl) with safe resolver
- Admin dashboard (threat intel reports)
- Model monitoring: drift + periodic retraining pipeline
- Containerization (Docker + docker-compose)
- Deployment: Render/Railway/AWS + Netlify/Vercel

---

## 🧑‍💻 Author / Ownership
**Namith N**  
UPI Guard: End-to-end Full Stack + ML Project  
Use-case: fraud prevention in payment workflows

---
