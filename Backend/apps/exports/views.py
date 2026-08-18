from django.http import HttpResponse
from rest_framework.views import APIView

from Backend.apps.mirror.models import ProductoPrecioSap, VentaDetalle
from Backend.apps.mirror.utils import require_fecha_range
from Backend.apps.users.permissions import IsProveedor
from Backend.apps.users.scoping import scoped_proveedores

from .renderers import render_csv, render_xlsx

# Tope de filas por descarga: sin esto, un plano sin filtros podria intentar
# volcar la tabla completa (~2.7M filas en ventas_detalle) en un solo archivo.
MAX_EXPORT_ROWS = 100_000


class BaseExportView(APIView):
    """Vista base para exportar planos (Inventario, Ventas, Precios). Solo Proveedores."""

    permission_classes = [IsProveedor]
    columns = []
    filename = 'export'

    def get_rows(self, request):
        raise NotImplementedError('Cada exportador debe implementar get_rows().')

    def get(self, request, *args, **kwargs):
        # 'format' es un query param reservado por DRF para negociacion de
        # contenido (?format=json/api); por eso el propio se llama 'filetype'.
        filetype = request.query_params.get('filetype', 'csv')
        rows = self.get_rows(request)

        if filetype == 'xlsx':
            buffer = render_xlsx(self.columns, rows)
            response = HttpResponse(
                buffer.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )
            response['Content-Disposition'] = f'attachment; filename="{self.filename}.xlsx"'
            return response

        content = render_csv(self.columns, rows)
        response = HttpResponse(content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{self.filename}.csv"'
        return response


class InventoryExportView(BaseExportView):
    # Pendiente: conectar a la tabla real del mirror cuando se identifique
    # cual representa el inventario, trayendo todas sus columnas (igual que
    # SalesExportView y PricesExportView).
    columns = ['SKU', 'Descripcion', 'Cantidad']
    filename = 'inventario'

    def get_rows(self, request):
        return []


class SalesExportView(BaseExportView):
    """Plano de ventas: `ventas_detalle` en la base espejo. fecha_desde/fecha_hasta
    son obligatorios (evita volcar la tabla completa sin filtro).

    Columnas y orden calcados del plano de referencia
    "VENTA U-P-V-C-A CON DEV V3.xlsx". Ese archivo tiene 3 columnas que no
    existen como dato crudo en ventas_detalle y por eso no se replican aqui:
    "Nombre de serie" (serie del documento), "PRECIOTTLSINDCTO" y "VLRDTO"
    (ambas parecen calculadas, no columnas de la tabla origen). Tambien trae
    "TIPOLOGIA" duplicada dos veces; aqui solo aparece una vez.
    """

    # (encabezado igual al del Excel de referencia, campo en el modelo)
    FIELD_MAP = [
        ('ID interno de documento', 'id_interno_documento'),
        ('Número de documento', 'numero_documento'),
        ('Unidad', 'unidad_medida'),
        ('Número', 'numero_ref'),
        ('PROVEEDOR', 'proveedor'),
        ('VENDEDOR', 'vendedor_nombre'),
        ('COD', 'cod_producto'),
        ('PRODUCTO', 'producto'),
        ('CANTIDAD', 'cantidad'),
        ('VENTA', 'venta_bruta'),
        ('ICUI', 'icui'),
        ('IVA', 'iva'),
        ('DESC', 'descuento_porcentaje'),
        ('FECHA', 'fecha'),
        ('CODCLIENTE', 'cod_cliente'),
        ('NOMCLIENTE', 'nom_cliente'),
        ('NIT', 'nit_cliente'),
        ('TIPOLOGIA', 'tipologia_cliente'),
        ('CIUDAD', 'ciudad'),
        ('Código Transportador', 'cod_transportador'),
        ('Número de línea', 'numero_linea'),
        ('Indicador de impuestos', 'indicador_impuestos'),
        ('NoNC', 'nc_vinculada'),
        ('CantNC', 'cant_nc'),
        ('LineTotalNC', 'line_total_nc'),
        ('IVANC', 'iva_nc'),
        ('TotalCant', 'total_cant_final'),
        ('LineTotal', 'line_total_final'),
        ('TotalIVA', 'total_iva_final'),
        ('Concepto  NC', 'concepto_nc'),
        ('ID Picking', 'id_picking'),
        ('ALM', 'alm'),
        ('PRECIOUNSINDCTO', 'precio_un_sin_dcto'),
    ]
    columns = [header for header, _field in FIELD_MAP]
    filename = 'ventas'

    def get_rows(self, request):
        fecha_desde, fecha_hasta = require_fecha_range(request.query_params)
        qs = VentaDetalle.objects.using('mirror').filter(fecha__gte=fecha_desde, fecha__lte=fecha_hasta)

        allowed_proveedores = scoped_proveedores(request.user)
        if allowed_proveedores is not None:
            qs = qs.filter(proveedor__in=allowed_proveedores)

        qs = qs.order_by('-fecha', 'id_interno_documento', 'numero_linea')
        db_fields = [field for _header, field in self.FIELD_MAP]
        return qs.values_list(*db_fields)[:MAX_EXPORT_ROWS]


class PricesExportView(BaseExportView):
    """Plano de precios: todas las columnas de `productos_precios_sap` en la base espejo, filtrable por proveedor."""

    # Mismo orden que los campos del modelo ProductoPrecioSap (todas las columnas de la tabla real).
    columns = [
        'id', 'cod_producto', 'nombre_producto', 'cod_grupo', 'proveedor',
        'bodega', 'precio', 'iva', 'ultima_vez_visto', 'created_at', 'updated_at',
    ]
    filename = 'precios'

    def get_rows(self, request):
        qs = ProductoPrecioSap.objects.using('mirror').all()

        proveedor = request.query_params.get('proveedor')
        if proveedor:
            qs = qs.filter(proveedor__icontains=proveedor)

        allowed_proveedores = scoped_proveedores(request.user)
        if allowed_proveedores is not None:
            qs = qs.filter(proveedor__in=allowed_proveedores)

        qs = qs.order_by('cod_producto')
        return qs.values_list(*self.columns)[:MAX_EXPORT_ROWS]
