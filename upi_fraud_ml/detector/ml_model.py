from pathlib import Path
import joblib

# Base dir = project root (where manage.py is)
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "upi_url_model.pkl"

print(f"[ML] Loading model from {MODEL_PATH}...")
model = joblib.load(MODEL_PATH)
print("[ML] Model loaded.")

# Thresholds tuned to favor higher precision (>=0.98) at ~0.75
FRAUD_HARD_THRESHOLD = 0.75    # definitely fraud
FRAUD_SOFT_THRESHOLD = 0.45    # suspicious band (surfacing borderline cases)


def classify_url(raw_url: str):
    """
    Returns:
    {
      "prediction": "fraud" | "suspicious" | "genuine" | "unknown",
      "fraud_probability": float or null,
      "genuine_probability": float or null
    }
    """
    if not raw_url or not isinstance(raw_url, str):
        return {
            "prediction": "unknown",
            "fraud_probability": None,
            "genuine_probability": None,
        }

    # Pipeline has tfidf + RandomForest, so predict_proba works directly
    proba = model.predict_proba([raw_url])[0]
    classes = list(model.classes_)   # e.g. ['fraud', 'genuine']

    fraud_idx = classes.index("fraud")
    genuine_idx = classes.index("genuine")

    fraud_p = float(proba[fraud_idx])
    genuine_p = float(proba[genuine_idx])

    # 3-level decision
    if fraud_p >= FRAUD_HARD_THRESHOLD:
        label = "fraud"
    elif fraud_p >= FRAUD_SOFT_THRESHOLD:
        label = "suspicious"
    else:
        label = "genuine"

    return {
        "prediction": label,
        "fraud_probability": fraud_p,
        "genuine_probability": genuine_p,
    }
