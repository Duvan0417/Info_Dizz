from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    PivotFieldValuesView,
    PivotMetadataView,
    PivotSavedViewSet,
    PivotVentaDetalleView,
    ProveedoresListView,
    VendedorPresupuestoListView,
    VendedoresListView,
    VentaDetalleViewSet,
)

router = DefaultRouter()
router.register('ventas-detalle', VentaDetalleViewSet, basename='venta-detalle')
router.register('ventas-detalle/pivot/vistas', PivotSavedViewSet, basename='pivot-vistas')

urlpatterns = [
    path('proveedores/', ProveedoresListView.as_view(), name='proveedores-list'),
    path('vendedores/', VendedoresListView.as_view(), name='vendedores-list'),
    path('ventas-detalle/pivot/', PivotVentaDetalleView.as_view(), name='ventas-detalle-pivot'),
    path('ventas-detalle/pivot/campos/', PivotMetadataView.as_view(), name='ventas-detalle-pivot-campos'),
    path('ventas-detalle/pivot/valores/', PivotFieldValuesView.as_view(), name='ventas-detalle-pivot-valores'),
    path(
        'ventas-detalle/pivot/presupuestos/',
        VendedorPresupuestoListView.as_view(),
        name='ventas-detalle-pivot-presupuestos',
    ),
] + router.urls
