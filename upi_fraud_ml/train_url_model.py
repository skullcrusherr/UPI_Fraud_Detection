from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_curve,
)
import joblib

# -------------------------------------------------
# CONFIG
# -------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)

MODEL_PATH = MODEL_DIR / "upi_url_model.pkl"

# Use full dataset for best performance; set to an int to subsample.
SUBSAMPLE_N = None   # was 500_000


# -------------------------------------------------
# LOAD & NORMALIZE EACH DATASET
# -------------------------------------------------
def load_balanced_urls(path: Path) -> pd.DataFrame:
    """
    balanced_urls.csv
    Columns: url, label ('benign' / 'malicious'), result (0/1)
    We convert to: url_text, label ('genuine' / 'fraud')
    """
    if not path.exists():
        print(f"[WARN] balanced_urls.csv not found at {path}")
        return pd.DataFrame(columns=["url_text", "label"])

    print(f"[INFO] Loading balanced URLs from {path}")
    df = pd.read_csv(path)

    # Keep necessary columns
    df = df[["url", "label"]].dropna()

    # Map to 'genuine' / 'fraud'
    df["label_str"] = df["label"].map(
        lambda x: "fraud" if str(x).lower() == "malicious" else "genuine"
    )

    df_out = df[["url", "label_str"]].rename(
        columns={"url": "url_text", "label_str": "label"}
    )

    print("[INFO] balanced_urls distribution:", df_out["label"].value_counts().to_dict())
    return df_out


def load_malicious_phish(path: Path) -> pd.DataFrame:
    """
    malicious_phish.csv
    Columns: url, type ('benign', 'phishing', 'defacement', 'malware')
    We treat ANYTHING not 'benign' as 'fraud'.
    """
    if not path.exists():
        print(f"[WARN] malicious_phish.csv not found at {path}")
        return pd.DataFrame(columns=["url_text", "label"])

    print(f"[INFO] Loading malicious_phish from {path}")
    df = pd.read_csv(path)

    df = df[["url", "type"]].dropna()

    df["label_str"] = df["type"].map(
        lambda t: "genuine" if str(t).lower() == "benign" else "fraud"
    )

    df_out = df[["url", "label_str"]].rename(
        columns={"url": "url_text", "label_str": "label"}
    )

    print("[INFO] malicious_phish distribution:", df_out["label"].value_counts().to_dict())
    return df_out


def load_phiusiil(path: Path) -> pd.DataFrame:
    """
    PhiUSIIL_Phishing_URL_Dataset.csv
    Has many feature columns and:
        - URL
        - label (0/1) where 1 = phishing (malicious), 0 = legitimate
    We only use URL + label for this text model.
    """
    if not path.exists():
        print(f"[WARN] PhiUSIIL dataset not found at {path}")
        return pd.DataFrame(columns=["url_text", "label"])

    print(f"[INFO] Loading PhiUSIIL dataset from {path}")
    df = pd.read_csv(path)

    df = df[["URL", "label"]].dropna()

    df["label_str"] = df["label"].map(
        lambda v: "fraud" if int(v) == 1 else "genuine"
    )

    df_out = df[["URL", "label_str"]].rename(
        columns={"URL": "url_text", "label_str": "label"}
    )

    print("[INFO] PhiUSIIL distribution:", df_out["label"].value_counts().to_dict())
    return df_out


# -------------------------------------------------
# MAIN MERGE FUNCTION
# -------------------------------------------------
def build_merged_dataset() -> pd.DataFrame:
    balanced_path = DATA_DIR / "balanced_urls.csv"
    mal_phish_path = DATA_DIR / "malicious_phish.csv"
    phiusiil_path = DATA_DIR / "PhiUSIIL_Phishing_URL_Dataset.csv"

    frames = []

    frames.append(load_balanced_urls(balanced_path))
    frames.append(load_malicious_phish(mal_phish_path))
    frames.append(load_phiusiil(phiusiil_path))

    # Filter out empty frames (if any file missing)
    frames = [f for f in frames if not f.empty]

    if not frames:
        raise RuntimeError("No datasets loaded – check your data directory and filenames.")

    df = pd.concat(frames, ignore_index=True)

    # Drop empties just in case
    df = df.dropna(subset=["url_text", "label"])
    df = df[df["url_text"].str.len() > 0]

    # Optional subsampling
    if SUBSAMPLE_N is not None and len(df) > SUBSAMPLE_N:
        df = df.sample(SUBSAMPLE_N, random_state=42)

    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)  # shuffle

    print("[INFO] Combined dataset shape:", df.shape)
    print("[INFO] Overall label distribution:\n", df["label"].value_counts())
    return df


# -------------------------------------------------
# TRAINING
# -------------------------------------------------
def train_and_save_model(df: pd.DataFrame):
    X = df["url_text"]
    y = df["label"]

    # Train–test split
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.1,
        random_state=42,
        stratify=y,
    )

    print("[INFO] Train size:", X_train.shape[0], "Test size:", X_test.shape[0])

    # Pipeline: char-level TF-IDF + Logistic Regression
    pipeline = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    analyzer="char",
                    ngram_range=(3, 5),
                    max_features=200000,
                    min_df=2,
                    lowercase=True,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=250,
                    n_jobs=-1,
                    solver="saga",
                    C=1.5,  # slightly stronger regularization to reduce overfitting FPs
                    class_weight={"fraud": 1.0, "genuine": 1.5},  # penalize false frauds for precision
                ),
            ),
        ]
    )

    print("[INFO] Training model...")
    pipeline.fit(X_train, y_train)
    print("[INFO] Training complete.")

    # Evaluation
    print("\n[INFO] Evaluating on test set...")
    y_pred = pipeline.predict(X_test)

    print("\nClassification report:")
    print(classification_report(y_test, y_pred))

    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Threshold sweeps for fraud precision/recall
    proba = pipeline.predict_proba(X_test)
    classes = list(pipeline.classes_)
    fraud_idx = classes.index("fraud")
    fraud_scores = proba[:, fraud_idx]

    for t in [0.5, 0.6, 0.8]:
        preds = np.where(fraud_scores >= t, "fraud", "genuine")
        cm = confusion_matrix(y_test, preds, labels=["fraud", "genuine"])
        tp = cm[0, 0]
        fp = cm[1, 0]
        fn = cm[0, 1]
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        print(f"\n[THRESHOLD {t:.2f}] fraud precision={precision:.4f} recall={recall:.4f}")

    precisions, recalls, thresholds = precision_recall_curve(
        (y_test == "fraud").astype(int), fraud_scores
    )
    target_prec = 0.98
    candidates = [
        (p, r, t)
        for p, r, t in zip(precisions[:-1], recalls[:-1], thresholds)
        if p >= target_prec
    ]
    if candidates:
        best_p, best_r, best_t = max(candidates, key=lambda x: (x[1], x[0]))
        print(
            f"\n[INFO] Threshold achieving ≥{target_prec:.2f} precision with best recall:"
            f" threshold={best_t:.3f}, precision={best_p:.4f}, recall={best_r:.4f}"
        )
    else:
        best_idx = int(np.argmax(precisions))
        print(
            f"\n[INFO] Max observed precision={precisions[best_idx]:.4f}"
            f" at recall={recalls[best_idx]:.4f} (threshold grid search)"
        )

    # Some manual sanity checks
    sample_urls = [
        "https://paytm.com/recharge?amount=500",
        "https://bonus-offer-paytm-support.co/claim?user=abc",
        "upi://pay?pa=abcd@oksbi&am=500&tn=Food+Order",
        "upi://pay?pa=kycbonus@okaxis&am=9999&tn=KYC+Verification+Reward",
    ]
    sample_pred = pipeline.predict(sample_urls)
    print("\n[INFO] Sample predictions:")
    for u, p in zip(sample_urls, sample_pred):
        print(f"  {u} -> {p}")

    # Save model
    joblib.dump(pipeline, MODEL_PATH)
    print(f"\n[SUCCESS] Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    print("[INFO] Building merged dataset from all sources...")
    df_all = build_merged_dataset()
    train_and_save_model(df_all)
