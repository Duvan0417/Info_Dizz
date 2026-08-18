from rest_framework import serializers

from .models import PivotSavedView, VendedorPresupuesto, VentaDetalle


class VentaDetalleSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalle
        exclude = ['pk']


class VendedorPresupuestoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendedorPresupuesto
        fields = ['vendedor', 'monto', 'updated_at']


class PivotSavedViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PivotSavedView
        fields = ['id', 'name', 'config', 'result', 'created_at', 'updated_at']
