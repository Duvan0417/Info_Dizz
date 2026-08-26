from rest_framework import serializers

from .models import PivotSavedView, PremioTier, VendedorPresupuesto, VentaDetalle


class VentaDetalleSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalle
        exclude = ['pk']


class VendedorPresupuestoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendedorPresupuesto
        fields = ['vendedor', 'monto', 'updated_at']


class PremioTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = PremioTier
        fields = ['id', 'porcentaje', 'valor', 'updated_at']


class PivotSavedViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PivotSavedView
        fields = [
            'id',
            'name',
            'config',
            'result',
            'presupuestos',
            'fecha_inicio',
            'fecha_fin',
            'cerrado',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['fecha_inicio', 'fecha_fin', 'cerrado']
