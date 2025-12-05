from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
import numpy as np

# ---------------- CONFIG ----------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

SUBSAMPLE_N = 400_000  # keep it manageable; change or set to None for full


def load_balanced_urls(path: Path) -> pd.DataFrame:
    if not path.exists():
        print(f"[WARN] missing: {path}")
        return pd.DataFrame(columns=["url_text", "label"])
    print(f"[INFO] balanced_urls -> {path}")
    df = pd.read_csv(path)
    df = df[["url", "label"]].dropna()
    df["label_str"] = df["label"].map(
        lambda x: "fraud" if str(x).lower() == "malicious" else "genuine"
    )
    out = df[["url", "label_str"]].rename(columns={"url": "url_text", "label_str": "label"})
    return out


def load_malicious_phish(path: Path) -> pd.DataFrame:
    if not path.exists():
        print(f"[WARN] missing: {path}")
        return pd.DataFrame(columns=["url_text", "label"])
    print(f"[INFO] malicious_phish -> {path}")
    df = pd.read_csv(path)
    df = df[["url", "type"]].dropna()
    df["label_str"] = df["type"].map(
        lambda t: "genuine" if str(t).lower() == "benign" else "fraud"
    )
    out = df[["url", "label_str"]].rename(columns={"url": "url_text", "label_str": "label"})
    return out


def load_phiusiil(path: Path) -> pd.DataFrame:
    if not path.exists():
        print(f"[WARN] missing: {path}")
        return pd.DataFrame(columns=["url_text", "label"])
    print(f"[INFO] PhiUSIIL -> {path}")
    df = pd.read_csv(path)
    df = df[["URL", "label"]].dropna()
    df["label_str"] = df["label"].map(lambda v: "fraud" if int(v) == 1 else "genuine")
    out = df[["URL", "label_str"]].rename(columns={"URL": "url_text", "label_str": "label"})
    return out


def build_merged_dataset() -> pd.DataFrame:
    balanced_path = DATA_DIR / "balanced_urls.csv"
    mal_path = DATA_DIR / "malicious_phish.csv"
    phi_path = DATA_DIR / "PhiUSIIL_Phishing_URL_Dataset.csv"

    frames = [
        load_balanced_urls(balanced_path),
        load_malicious_phish(mal_path),
        load_phiusiil(phi_path),
    ]
    frames = [f for f in frames if not f.empty]

    if not frames:
        raise RuntimeError("No datasets loaded")

    df = pd.concat(frames, ignore_index=True)
    df = df.dropna(subset=["url_text", "label"])
    df = df[df["url_text"].str.len() > 0]

    if SUBSAMPLE_N is not None and len(df) > SUBSAMPLE_N:
        df = df.sample(SUBSAMPLE_N, random_state=42)

    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
    print("[INFO] merged shape:", df.shape)
    print("[INFO] label distribution:\n", df["label"].value_counts())
    return df


def evaluate_model(name, model, X_train, X_test, y_train, y_test):
    print("\n" + "=" * 80)
    print(f"[MODEL] {name}")
    print("=" * 80)

    pipeline = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    max_features=10000,
                    lowercase=True,
                    token_pattern=r"[A-Za-z0-9@._:/?=&%-]+",
                ),
            ),
            ("clf", model),
        ]
    )

    print("[INFO] fitting...")
    pipeline.fit(X_train, y_train)
    print("[INFO] done.")

    y_pred = pipeline.predict(X_test)

    print("\nClassification report:")
    print(classification_report(y_test, y_pred))

    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Return pipeline if you want to keep the best later
    return pipeline


if __name__ == "__main__":
    df = build_merged_dataset()
    X = df["url_text"]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    # Candidate models
    models = {
        "logreg_default": LogisticRegression(
            max_iter=500, n_jobs=-1
        ),
        "logreg_balanced": LogisticRegression(
            max_iter=500, n_jobs=-1, class_weight="balanced"
        ),
        "rf_balanced": RandomForestClassifier(
            n_estimators=200,
            max_depth=25,
            n_jobs=-1,
            class_weight="balanced_subsample",
        ),
    }

    best_name = None
    best_pipeline = None
    best_fraud_recall = -1.0

    for name, clf in models.items():
        pipeline = evaluate_model(name, clf, X_train, X_test, y_train, y_test)

        # compute fraud recall manually from confusion matrix
        y_pred = pipeline.predict(X_test)
        labels = sorted(list(set(y_test)))
        # confusion_matrix order follows labels order; ensure 'fraud' is index 0 or 1
        cm = confusion_matrix(y_test, y_pred, labels=["fraud", "genuine"])
        # cm[0,0] = TP for fraud, cm[0,:].sum() = all actual fraud
        fraud_tp = cm[0, 0]
        fraud_total = cm[0, :].sum()
        fraud_recall = fraud_tp / fraud_total if fraud_total > 0 else 0.0
        print(f"[METRIC] {name} fraud recall = {fraud_recall:.4f}")

        if fraud_recall > best_fraud_recall:
            best_fraud_recall = fraud_recall
            best_name = name
            best_pipeline = pipeline

    print("\n" + "#" * 80)
    print(f"[BEST MODEL BY FRAUD RECALL] {best_name} with fraud recall={best_fraud_recall:.4f}")
    print("#" * 80)
