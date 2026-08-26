from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ClientesSinVentaView,
    DiasHabilesView,
    PivotFieldValuesView,
    PivotMetadataView,
    PivotSavedViewSet,
    PivotVentaDetalleView,
    PremioTierViewSet,
    ProveedoresListView,
    VendedorConcursosView,
    VendedorPresupuestoListView,
    VendedoresListView,
    VentaDetalleViewSet,
)

router = DefaultRouter()
router.register('ventas-detalle', VentaDetalleViewSet, basename='venta-detalle')
router.register('ventas-detalle/pivot/vistas', PivotSavedViewSet, basename='pivot-vistas')
router.register('ventas-detalle/pivot/premios', PremioTierViewSet, basename='pivot-premios')

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
    path(
        'ventas-detalle/pivot/vistas/vendedor/',
        VendedorConcursosView.as_view(),
        name='ventas-detalle-pivot-vistas-vendedor',
    ),
    path('clientes-sin-venta/', ClientesSinVentaView.as_view(), name='clientes-sin-venta'),
    path('dias-habiles/', DiasHabilesView.as_view(), name='dias-habiles'),
] + router.urls
