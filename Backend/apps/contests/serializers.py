from rest_framework import serializers

from .models import Contest


class ContestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contest
        fields = ['id', 'external_id', 'name', 'start_date', 'end_date', 'conditions', 'is_active']
