# 🔐 UPI Guard — AI-Based UPI Fraud Detection System  
### React Frontend · Django Backend · Machine Learning · MongoDB Atlas · QR Scanner · URL Scanner

UPI Guard is a full-stack fraud detection platform designed to protect users from phishing UPI URLs, malicious QR codes, and suspicious payment links.

This system uses:
- 🧠 Machine Learning (RandomForest) to classify URLs  
- 🐍 Django REST API for prediction + QR decoding  
- 🗃 MongoDB Atlas for scan history + analytics  
- ⚛️ React for a beautiful modern UI  
- 📸 Live QR scanning support  
- 📊 Dashboard with Pie Chart analytics  

---

## 🚀 Features

### 🔍 1. UPI URL Fraud Detector  
- Paste any UPI link or payment URL  
- Backend ML model predicts:
  - Fraud  
  - Genuine  
  - Suspicious  

### 🧾 2. QR Code Scanner  
- Upload QR images  
- System auto-decodes URL inside QR  
- Runs ML prediction  
- Shows fraud probability  
- Generates a safe QR code for trusted URLs  

### 📊 3. Dashboard Analytics  
Visual breakdown of all scanned URLs:
- Fraud Count  
- Genuine Count  
- Suspicious Count  

### 📁 4. Scan History Page  
Pulled from MongoDB:
- Timestamp  
- URL scanned  
- Prediction type  
- Fraud/Genuine probabilities  

### ⚙️ 5. Django REST Backend  
Endpoints:
- /api/predict-url/  
- /api/decode-qr/  
- /api/history/  
- /api/stats/  

### 🧠 6. ML Model  
Trained using:
- Phishing datasets  
- RandomForest classifier  
- TfidfVectorizer  

---

# 🏗 System Architecture

UPI Guard System:

    ┌──────────────────┐        HTTP/JSON         ┌──────────────────┐
    │                  │  ─────────────────────→  │                  │
    │  React Frontend  │                          │ Django Backend   │
    │  (Vite + React)  │                          │  REST Framework  │
    │                  │  ←─────────────────────  │                  │
    └──────────────────┘      Predictions         └──────────────────┘
                │                                             │
                │                                             ▼
                │                                   ┌──────────────────┐
                │                                   │ ML Model (RF)    │
                │                                   │ URL Vectorizer   │
                │                                   └──────────────────┘
                │                                             │
                ▼                                             ▼
    ┌──────────────────┐                          ┌──────────────────┐
    │ QR Code Scanner  │                          │ MongoDB Atlas    │
    │ (Frontend)       │                          │ Scan Logs + Stats│
    └──────────────────┘                          └──────────────────┘


---

# ⚙️ Installation Guide (Linux / Ubuntu)

## 1️⃣ Clone the repository
git clone https://github.com/YOUR_USERNAME/upi-fraud-detection.git
cd upi-fraud-detection

yaml
Copy code

---

# 🐍 Backend Setup (Django)

## 2️⃣ Create virtual environment
cd upi_fraud_ml
python3 -m venv venv
source venv/bin/activate

shell
Copy code

## 3️⃣ Install dependencies
pip install -r requirements.txt

yaml
Copy code

## 4️⃣ Configure MongoDB Atlas  
Edit detector/db.py:

MONGO_URI = "mongodb+srv://<username>:<password>@<cluster>.mongodb.net/"
DB_NAME = "urlfrauddetection"
COLLECTION = "scan_logs"

csharp
Copy code

Make sure your IP is added under:
MongoDB Atlas → Network Access → Add IP

## 5️⃣ Run Django server
python manage.py runserver

yaml
Copy code

Backend will run at:
http://127.0.0.1:8000

---

# ⚛️ Frontend Setup (React + Vite)

## 6️⃣ Install Node 20+
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

shell
Copy code

## 7️⃣ Install React dependencies
cd upi_fraud_frontend
npm install
npm install recharts qrcode.react

shell
Copy code

## 8️⃣ Start the frontend
npm run dev

yaml
Copy code

Frontend runs at:
http://localhost:5173

---

# 🌐 REST API Endpoints

| Endpoint | Method | Description |
|---------|--------|-------------|
| `/api/predict-url/` | POST | Predict fraud type for a URL |
| `/api/decode-qr/` | POST | Decode QR + predict URL |
| `/api/history/` | GET | Fetch recent scans |
| `/api/stats/` | GET | Fraud/Genuine/Suspicious stats |

---

# 📦 ML Model Training (Optional)

python train_url_model.py

csharp
Copy code

The trained model is saved at:
models/upi_url_model.pkl

yaml
Copy code

---

# 🧪 Example API Testing

### URL Prediction
curl -X POST http://127.0.0.1:8000/api/predict-url/
-H "Content-Type: application/json"
-d '{"raw_url":"https://paytm.com"}'

shell
Copy code

### QR Decode Test
curl -X POST -F "qr_image=@sample.png" http://127.0.0.1:8000/api/decode-qr/

yaml
Copy code

---

# 🗃 MongoDB Schema

{
"raw_url": "https://example.com",
"prediction": "genuine",
"fraud_probability": 0.12,
"genuine_probability": 0.88,
"timestamp": "2025-12-05T10:15:30"
}
