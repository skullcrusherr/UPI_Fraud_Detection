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

class QrDecodeView(APIView):
    """
    Accepts a QR image upload, decodes it, runs the ML model on the
    decoded text (usually a UPI link or URL), logs to Mongo, and
    returns both the decoded payload and classification.
    """

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        qr_file = request.FILES.get("qr_image")

        if not qr_file:
            return Response(
                {"detail": "No file provided. Use field name 'qr_image'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Read image into numpy array
            img = Image.open(qr_file).convert("RGB")
            img_np = np.array(img)

            detector = cv2.QRCodeDetector()
            decoded_text, points, _ = detector.detectAndDecode(img_np)

            if not decoded_text:
                return Response(
                    {"detail": "No QR code detected or decode failed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Run through our existing ML model
            result = classify_url(decoded_text)

            # Log scan (same as URL scans)
            log_scan(
                decoded_text,
                result["prediction"],
                result["fraud_probability"],
                result["genuine_probability"],
            )

            # Return everything to frontend
            payload = {
                "decoded_payload": decoded_text,
                "prediction": result["prediction"],
                "fraud_probability": result["fraud_probability"],
                "genuine_probability": result["genuine_probability"],
            }
            return Response(payload, status=status.HTTP_200_OK)

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
