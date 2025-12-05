from rest_framework import serializers


class UrlCheckSerializer(serializers.Serializer):
    raw_url = serializers.CharField(allow_blank=False)
