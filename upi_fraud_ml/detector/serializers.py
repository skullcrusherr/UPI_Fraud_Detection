from rest_framework import serializers


class UrlCheckSerializer(serializers.Serializer):
    raw_url = serializers.CharField(allow_blank=False)


class UpiEvaluateSerializer(serializers.Serializer):
    raw_url = serializers.CharField()

    expected_vpa = serializers.CharField(required=False, allow_blank=True)
    expected_name = serializers.CharField(required=False, allow_blank=True)
    expected_amount = serializers.CharField(required=False, allow_blank=True)

    intent = serializers.ChoiceField(
        choices=["merchant_payment", "personal_transfer", "refund", "prize_cashback", "unknown"],
        required=False,
        default="unknown"
    )

    source = serializers.ChoiceField(
        choices=["printed_shop_qr", "website_checkout", "whatsapp_telegram", "sms", "unknown"],
        required=False,
        default="unknown"
    )

    scam_checkbox = serializers.BooleanField(required=False, default=False)
