from pymongo import MongoClient
from datetime import datetime
import os
from django.utils import timezone

# ------------------------------------------------------------------
# CONFIG: Cloud MongoDB Atlas (default) or local MongoDB fallback
# ------------------------------------------------------------------

# Your Atlas connection string:
ATLAS_URI = (
    "mongodb+srv://upifrauddetection_db_user:6E92wDxn5NSZtIiy"
    "@urlfrauddetection.qnglton.mongodb.net/"
    "?retryWrites=true&w=majority&appName=urlfrauddetection"
)

# Use environment variable if present, else default to ATLAS URI
MONGO_URI = os.getenv("MONGO_URI", ATLAS_URI)

DB_NAME = "upi_guard"
COLLECTION_NAME = "scan_logs"

# ------------------------------------------------------------------
# CONNECT TO MONGO
# ------------------------------------------------------------------

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    db = client[DB_NAME]
    scan_logs = db[COLLECTION_NAME]

    # Ping server to test connection
    client.admin.command("ping")

    MONGO_AVAILABLE = True
    print("[DB] Connected to MongoDB:", MONGO_URI)

except Exception as e:
    print(f"[DB] MongoDB not available: {e}")
    print("[DB] Falling back to NO-DB mode (logging disabled).")
    scan_logs = None
    MONGO_AVAILABLE = False


# ------------------------------------------------------------------
# FUNCTION: Log each scan result
# ------------------------------------------------------------------
def log_scan(raw_url, prediction, fraud_p, genuine_p):
    """
    Save each scan to MongoDB.
    If DB is unavailable, silently skip.
    """
    if not MONGO_AVAILABLE or scan_logs is None:
        print("[DB] Skipping log_scan, MongoDB not available.")
        return

    doc = {
        "raw_url": raw_url,
        "prediction": prediction,   # fraud/suspicious/genuine
        "fraud_probability": fraud_p,
        "genuine_probability": genuine_p,
        "timestamp": datetime.utcnow(),
    }

    try:
        scan_logs.insert_one(doc)
    except Exception as e:
        print(f"[DB] Failed to insert log: {e}")


# ------------------------------------------------------------------
# FUNCTION: Return fraud/suspicious/genuine stats
# ------------------------------------------------------------------
def get_stats():
    """
    Return aggregated stats:
    { "fraud": N, "suspicious": N, "genuine": N }
    """
    stats = {"fraud": 0, "suspicious": 0, "genuine": 0}

    if not MONGO_AVAILABLE or scan_logs is None:
        print("[DB] MongoDB not available, returning empty stats.")
        return stats

    try:
        pipeline = [
            {"$group": {"_id": "$prediction", "count": {"$sum": 1}}},
        ]
        results = scan_logs.aggregate(pipeline)

        for r in results:
            stats[r["_id"]] = r["count"]

    except Exception as e:
        print(f"[DB] Failed to aggregate stats: {e}")

    return stats

users = db["users"]  # new collection


def get_user_by_email(email: str):
    """Return a user document or None."""
    if not email:
        return None
    return users.find_one({"email": email.lower().strip()})


def create_user(email: str, password_hash: str, name: str | None = None):
    """Insert a new user and return the inserted document."""
    doc = {
        "email": email.lower().strip(),
        "password_hash": password_hash,
        "name": name or "",
        "created_at": timezone.now(),
        "updated_at": timezone.now(),
    }
    result = users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc
def get_recent_scans(limit: int = 50):
    """
    Return a list of the most recent scan documents.
    Strips _id so it's JSON-serializable.
    """
    if limit <= 0:
        limit = 50
    if limit > 200:
        limit = 200

    cursor = (
        scan_logs.find({}, {"_id": 0})
        .sort("timestamp", -1)  # 👈 use 'timestamp' here
        .limit(limit)
    )
    return list(cursor)
