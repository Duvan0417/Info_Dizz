from django.urls import path

from .views import InventoryExportView, PricesExportView, SalesExportView

urlpatterns = [
    path('inventory/', InventoryExportView.as_view(), name='export-inventory'),
    path('sales/', SalesExportView.as_view(), name='export-sales'),
    path('prices/', PricesExportView.as_view(), name='export-prices'),
]
