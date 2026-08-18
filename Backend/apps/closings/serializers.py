from rest_framework import serializers

from .models import Closing


class ClosingSerializer(serializers.ModelSerializer):
    closed_by = serializers.ReadOnlyField(source='closed_by.username')

    class Meta:
        model = Closing
        fields = ['id', 'period_label', 'closed_at', 'closed_by', 'is_frozen']
        read_only_fields = ['id', 'closed_at', 'closed_by']
