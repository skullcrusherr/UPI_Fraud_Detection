# detector/upi_features.py
from urllib.parse import urlparse, parse_qs
import re
from difflib import SequenceMatcher
import urllib.parse
from collections import Counter

SCAM_KEYWORDS = [
    "refund", "prize", "cashback", "kyc", "verification", "blocked", "urgent",
    "bonus", "reward", "activate", "offer", "claim"
]

# Handles that are common in India (not exhaustive)
KNOWN_HANDLES = set([
    "okaxis", "oksbi", "okhdfcbank", "okicici", "okpaytm", "ybl", "upi"
])

def norm_name(s: str) -> str:
    s = (s or "").strip().lower()
    s = urllib.parse.unquote_plus(s)   # handles %20 and +
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def dedupe_words(s: str) -> str:
    words = s.split()
    out = []
    seen = set()
    for w in words:
        if w not in seen:
            out.append(w)
            seen.add(w)
    return " ".join(out)

def token_overlap(a: str, b: str) -> float:
    a_tokens = norm_name(a).split()
    b_tokens = norm_name(b).split()
    if not a_tokens or not b_tokens:
        return 0.0
    a_set = set(a_tokens)
    b_set = set(b_tokens)
    return len(a_set & b_set) / max(len(a_set), 1)


def _sim(a: str, b: str) -> float:
    a = (a or "").strip().lower()
    b = (b or "").strip().lower()
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()

def parse_upi(raw_url: str) -> dict:
    """
    Extracts UPI params from upi://pay?... into a flat dict.
    """
    parsed = urlparse(raw_url)
    qs = parse_qs(parsed.query)

    def one(key):
        return (qs.get(key, [""]) or [""])[0].strip()

    pa = one("pa")
    pn = one("pn")
    am = one("am")
    cu = one("cu")
    tn = one("tn")
    mc = one("mc")
    tr = one("tr")

    handle = ""
    if "@" in pa:
        handle = pa.split("@", 1)[1].lower().strip()

    # normalize amount
    amount = None
    if am:
        try:
            amount = float(am)
        except:
            amount = None

    return {
        "pa": pa,
        "pn": pn,
        "am_raw": am,
        "amount": amount,
        "cu": cu,
        "tn": tn,
        "mc": mc,
        "tr": tr,
        "handle": handle,
        "is_upi": parsed.scheme.lower() == "upi",
    }

def rule_engine(raw_url: str, upi: dict, ctx: dict) -> dict:
    """
    Returns: { rule_score: float(0..1), signals: [..] }
    """
    signals = []
    score = 0.0

    # Basic structural validity
    if not upi.get("pa"):
        score += 0.35
        signals.append("Missing payee VPA (pa).")
    else:
        if not re.match(r"^[A-Za-z0-9.\-_]{2,}@[A-Za-z0-9.\-_]{2,}$", upi["pa"]):
            score += 0.30
            signals.append("VPA format looks invalid.")

    # Currency check
    if upi.get("cu") and upi["cu"].upper() != "INR":
        score += 0.30
        signals.append("Currency not INR.")

    # Handle check
    handle = (upi.get("handle") or "").lower()
    if handle and handle not in KNOWN_HANDLES:
        score += 0.18
        signals.append(f"Unknown/rare UPI handle: @{handle}")

    # Scam keywords in note
    note = (upi.get("tn") or "").lower()
    hit = [k for k in SCAM_KEYWORDS if k in note]
    if hit:
        score += 0.22
        signals.append(f"Transaction note contains risky keywords: {', '.join(hit[:4])}")

    # Context: intent/source/scam checkbox
    intent = (ctx.get("intent") or "unknown").lower()
    source = (ctx.get("source") or "unknown").lower()
    scam_checkbox = bool(ctx.get("scam_checkbox"))

    if scam_checkbox:
        score += 0.45
        signals.append("User indicated scam-like behavior (asked to pay for refund/prize/KYC).")

    if intent in ["refund", "prize_cashback"]:
        score += 0.28
        signals.append(f"High-risk payment intent: {intent}")

    if source in ["whatsapp_telegram", "sms"] and intent not in ["personal_transfer"]:
        score += 0.20
        signals.append(f"High-risk source: {source} for non-personal intent")

    # Expected payee match
    expected_vpa = (ctx.get("expected_vpa") or "").strip().lower()
    if expected_vpa:
        s = _sim(expected_vpa, upi.get("pa", "").lower())
        if s < 0.75:
            score += 0.35
            signals.append("Payee VPA does not match expected VPA.")

    expected_name = (ctx.get("expected_name") or "").strip()
    pn = upi.get("pn") or ""

    if expected_name and pn:
        exp_n = dedupe_words(norm_name(expected_name))
        pn_n = dedupe_words(norm_name(pn))

    # Strong allow: expected is contained inside pn (or vice versa)
        if exp_n in pn_n or pn_n in exp_n:
            pass
        else:
            overlap = token_overlap(exp_n, pn_n)
            sim = _sim(exp_n, pn_n)  # your existing sequence matcher sim

        # Only flag mismatch if BOTH overlap and similarity are low
            if overlap < 0.50 and sim < 0.70:
                score += 0.18
                signals.append("Payee name does not match expected name.")


    # Expected amount match
    expected_amount = (ctx.get("expected_amount") or "").strip()
    if expected_amount:
        try:
            exp = float(expected_amount)
            amt = upi.get("amount")
            if amt is not None:
                diff = abs(exp - amt)
                if diff > 0.01 and diff / max(exp, 1.0) > 0.15:
                    score += 0.20
                    signals.append("Amount differs significantly from expected.")
        except:
            pass

    # Clamp
    score = max(0.0, min(1.0, score))
    return {"rule_score": score, "signals": signals}

def final_decision(ml_fraud_p: float, rule_score: float, is_upi: bool) -> dict:
    """
    Combine ML probability + rules into a final decision.
    """
    

    ml_fraud_p = float(ml_fraud_p)
    rule_score = float(rule_score)

    # Weighted blend (tuneable)
    if is_upi:
        risk = 0.25 * ml_fraud_p + 0.75 * rule_score
    else:
        risk = 0.60 * ml_fraud_p + 0.40 * rule_score

    if risk >= 0.65:
        decision = "fraud"
    elif risk >= 0.35:
        decision = "suspicious"
    else:
        decision = "genuine"

    return {"risk_score": risk, "final_decision": decision}
