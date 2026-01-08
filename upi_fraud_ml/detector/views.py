from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import UrlCheckSerializer
from .ml_model import classify_url
from .db import log_scan

from rest_framework.parsers import MultiPartParser, FormParser
from PIL import Image
import numpy as np
import cv2

from .ml_model import classify_url
from .db import log_scan

import jwt
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password

from .serializers import UpiEvaluateSerializer
from .upi_features import parse_upi, rule_engine, final_decision

from .db import (
    log_scan,
    get_stats,
    get_user_by_email,
    create_user,
    get_recent_scans,
)


class UrlCheckView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = UrlCheckSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        raw_url = serializer.validated_data["raw_url"]
        result = classify_url(raw_url)

        # LOG THE RESULT TO MONGO
        log_scan(
            raw_url,
            result["prediction"],
            result["fraud_probability"],
            result["genuine_probability"]
        )

        return Response(result, status=status.HTTP_200_OK)

from .db import get_stats

class StatsView(APIView):
    def get(self, request, *args, **kwargs):
        stats = get_stats()
        return Response(stats, status=200)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from PIL import Image
import numpy as np
import cv2

try:
    from pyzbar.pyzbar import decode as pyzbar_decode
except Exception:
    pyzbar_decode = None

from .ml_model import classify_url
from .db import log_scan


# detector/views.py  (ONLY replace QrDecodeView)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from PIL import Image
import numpy as np
import cv2

from .ml_model import classify_url
from .db import log_scan


class QrDecodeView(APIView):
    """
    Accepts a QR image upload, decodes it, runs ML on decoded text,
    logs to Mongo, returns decoded payload + classification.
    """

    parser_classes = [MultiPartParser, FormParser]

    def _try_decode_opencv(self, img_np: np.ndarray) -> str:
        """Try multiple OpenCV strategies to decode QR."""
        detector = cv2.QRCodeDetector()

        # 1) Direct decode
        decoded_text, points, _ = detector.detectAndDecode(img_np)
        if decoded_text:
            return decoded_text.strip()

        # 2) Convert to grayscale
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        decoded_text, points, _ = detector.detectAndDecode(gray)
        if decoded_text:
            return decoded_text.strip()

        # 3) Improve contrast + threshold
        # (QR decoders love crisp black/white edges)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        boosted = clahe.apply(gray)

        _, th = cv2.threshold(boosted, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        decoded_text, points, _ = detector.detectAndDecode(th)
        if decoded_text:
            return decoded_text.strip()

        # 4) Slight denoise
        den = cv2.GaussianBlur(gray, (3, 3), 0)
        decoded_text, points, _ = detector.detectAndDecode(den)
        if decoded_text:
            return decoded_text.strip()

        return ""

    def post(self, request, *args, **kwargs):
        qr_file = request.FILES.get("qr_image")
        if not qr_file:
            return Response(
                {"detail": "No file provided. Use field name 'qr_image'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Read image into numpy RGB
            img = Image.open(qr_file).convert("RGB")
            img_np = np.array(img)

            decoded_text = self._try_decode_opencv(img_np)

            if not decoded_text:
                return Response(
                    {
                        "detail": "QR decode failed. Try: better lighting, keep QR centered, reduce tilt, fill more of the frame."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            result = classify_url(decoded_text)

            log_scan(
                decoded_text,
                result["prediction"],
                result["fraud_probability"],
                result["genuine_probability"],
            )

            return Response(
                {
                    "decoded_payload": decoded_text,
                    "prediction": result["prediction"],
                    "fraud_probability": result["fraud_probability"],
                    "genuine_probability": result["genuine_probability"],
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            print("[QR] Error while decoding:", e)
            return Response(
                {"detail": "Internal error while processing QR image."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RegisterView(APIView):
    """
    Simple registration: stores user in MongoDB 'users' collection.
    Returns a JWT token + basic user info.
    """

    def post(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        name = request.data.get("name") or ""

        if not email or not password:
            return Response(
                {"detail": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # basic length checks (you can tweak)
        if len(password) < 6:
            return Response(
                {"detail": "Password must be at least 6 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # check for existing user
        existing = get_user_by_email(email)
        if existing:
            return Response(
                {"detail": "User with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # hash password using Django's secure hasher
        password_hash = make_password(password)

        user_doc = create_user(email=email, password_hash=password_hash, name=name)

        # create JWT
        token = _create_jwt_for_user(str(user_doc["_id"]), email)

        return Response(
            {
                "token": token,
                "user": {
                    "email": email,
                    "name": name,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """
    Login against MongoDB 'users' collection.
    Verifies password hash and returns JWT token.
    """

    def post(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""

        if not email or not password:
            return Response(
                {"detail": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_doc = get_user_by_email(email)
        if not user_doc:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not check_password(password, user_doc.get("password_hash")):
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token = _create_jwt_for_user(str(user_doc["_id"]), email)

        return Response(
            {
                "token": token,
                "user": {
                    "email": email,
                    "name": user_doc.get("name", ""),
                },
            },
            status=status.HTTP_200_OK,
        )


# -------------------------------------------------------------------
# JWT helper
# -------------------------------------------------------------------
def _create_jwt_for_user(user_id: str, email: str) -> str:
    """
    Create a simple JWT for the given user.
    Not production-hardened (no refresh tokens, etc.), but fine for project.
    """
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=1),
        "iat": datetime.utcnow(),
    }
    secret = settings.SECRET_KEY
    token = jwt.encode(payload, secret, algorithm="HS256")
    # pyjwt>=2 returns str; in older versions it can be bytes
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token
class HistoryView(APIView):
    """
    Returns recent scan logs from MongoDB.
    Currently global (not per-user) – good for demo & admin view.
    """

    def get(self, request, *args, **kwargs):
        limit_param = request.query_params.get("limit")

        try:
            limit = int(limit_param) if limit_param is not None else 50
        except ValueError:
            limit = 50

        scans = get_recent_scans(limit=limit)

        return Response(
            {"results": scans},
            status=status.HTTP_200_OK,
        )

class UpiEvaluateView(APIView):
    """
    UPI-specific evaluation:
    - parses upi://pay params
    - runs existing ML classifier on raw_url (optional, but useful)
    - applies rule engine + user context
    - returns final decision + signals
    """
    def post(self, request, *args, **kwargs):
        print("UPI_EVAL CONTENT_TYPE:", request.content_type)
        print("UPI_EVAL DATA:", request.data)
        print("UPI_EVAL KEYS:", list(request.data.keys()))
        serializer = UpiEvaluateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        raw_url = serializer.validated_data["raw_url"].strip()
        ctx = {
            "expected_vpa": serializer.validated_data.get("expected_vpa", ""),
            "expected_name": serializer.validated_data.get("expected_name", ""),
            "expected_amount": serializer.validated_data.get("expected_amount", ""),
            "intent": serializer.validated_data.get("intent", "unknown"),
            "source": serializer.validated_data.get("source", "unknown"),
            "scam_checkbox": serializer.validated_data.get("scam_checkbox", False),
        }

        if not raw_url.lower().startswith("upi://"):
            return Response(
                {"detail": "This endpoint supports only upi://pay links."},
                status=status.HTTP_400_BAD_REQUEST
            )

        upi = parse_upi(raw_url)

        # ML prediction on the raw upi:// link (still useful but not perfect)
        ml = classify_url(raw_url)
        ml_fraud_p = float(ml.get("fraud_probability") or 0.0)

        rules = rule_engine(raw_url, upi, ctx)
        fused = final_decision(ml_fraud_p, rules["rule_score"], upi.get("is_upi", False))

        payload = {
            "prediction": ml.get("prediction"),  # base model label
            "fraud_probability": ml.get("fraud_probability"),
            "genuine_probability": ml.get("genuine_probability"),

            "rule_score": rules["rule_score"],
            "risk_score": fused["risk_score"],
            "final_decision": fused["final_decision"],
            "signals": rules["signals"],

            "upi": {
                "pa": upi.get("pa"),
                "pn": upi.get("pn"),
                "amount": upi.get("amount"),
                "cu": upi.get("cu"),
                "tn": upi.get("tn"),
                "handle": upi.get("handle"),
            }
        }

        # Log to Mongo (works if DB available)
        try:
            log_scan(
                raw_url,
                payload["final_decision"],
                payload["fraud_probability"],
                payload["genuine_probability"],
            )
        except Exception as e:
            print("[UPI-EVAL] log_scan failed:", e)

        return Response(payload, status=status.HTTP_200_OK)
