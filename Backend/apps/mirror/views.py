from decimal import Decimal, InvalidOperation

from django.db.models import Count, Sum
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet, ReadOnlyModelViewSet

from Backend.apps.users.permissions import HasRole, IsAdmin, IsSupervisor
from Backend.apps.users.scoping import apply_scoping, scoped_proveedores, scoped_vendedores

from . import pivot
from .models import PivotSavedView, ProductoPrecioSap, VendedorPresupuesto, VentaDetalle, Vendedor
from .serializers import PivotSavedViewSerializer, VendedorPresupuestoSerializer, VentaDetalleSerializer
from .utils import parse_fecha, require_fecha_range


class VentaDetallePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500


class VentaDetalleViewSet(ReadOnlyModelViewSet):
    """Consulta de solo lectura sobre `ventas_detalle` en la base espejo."""

    serializer_class = VentaDetalleSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = VentaDetallePagination

    def get_queryset(self):
        params = self.request.query_params
        qs = VentaDetalle.objects.using('mirror').all()

        fecha_desde = params.get('fecha_desde')
        fecha_hasta = params.get('fecha_hasta')
        if fecha_desde:
            qs = qs.filter(fecha__gte=parse_fecha('fecha_desde', fecha_desde))
        if fecha_hasta:
            qs = qs.filter(fecha__lte=parse_fecha('fecha_hasta', fecha_hasta))

        for param, field in [
            ('cod_producto', 'cod_producto'),
            ('cod_cliente', 'cod_cliente'),
            ('nit_cliente', 'nit_cliente'),
            ('numero_documento', 'numero_documento'),
            ('ciudad', 'ciudad'),
            ('unidad', 'unidad_medida'),
        ]:
            value = params.get(param)
            if value:
                qs = qs.filter(**{field: value})

        for param, field in [
            ('producto', 'producto'),
            ('nom_cliente', 'nom_cliente'),
            ('vendedor_nombre', 'vendedor_nombre'),
            ('proveedor', 'proveedor'),
        ]:
            value = params.get(param)
            if value:
                qs = qs.filter(**{f'{field}__icontains': value})

        allowed_proveedores = scoped_proveedores(self.request.user)
        if allowed_proveedores is not None:
            qs = qs.filter(proveedor__in=allowed_proveedores)

        allowed_vendedores = scoped_vendedores(self.request.user)
        if allowed_vendedores is not None:
            qs = qs.filter(vendedor_nombre__in=allowed_vendedores)

        return qs.order_by('-fecha', 'id_interno_documento', 'numero_linea')

    @action(detail=False, methods=['get'], url_path='por-vendedor')
    def por_vendedor(self, request):
        """Venta neta acumulada por vendedor (line_total_final/total_cant_final ya
        traen las devoluciones/notas credito restadas). Admite los mismos filtros
        que el listado; fecha_desde/fecha_hasta son obligatorios."""
        require_fecha_range(request.query_params)
        qs = self.get_queryset()
        data = (
            qs.values('vendedor_nombre')
            .annotate(
                total_venta=Sum('line_total_final'),
                total_cantidad=Sum('total_cant_final'),
                num_lineas=Count('numero_linea'),
            )
            .order_by('-total_venta')
        )
        return Response(list(data))


class ProveedoresListView(APIView):
    """Lista de proveedores para el selector de ADMIN (asignar proveedores,
    ve todos) y el filtro por proveedor en ventas-detalle para
    SUPERVISOR/DIRECTOR (PROVEEDOR no lo necesita: ya tiene su unico
    proveedor asignado por defecto). Un SUPERVISOR solo ve los proveedores
    que tiene asignados (los mismos por los que ya esta scopeado), no todos
    los del sistema; DIRECTOR/ADMIN ven la lista completa."""

    permission_classes = [HasRole]
    allowed_roles = ['ADMIN', 'SUPERVISOR', 'DIRECTOR']

    def get(self, request):
        allowed = scoped_proveedores(request.user)
        if allowed is not None:
            return Response(sorted(allowed))

        proveedores = (
            ProductoPrecioSap.objects.using('mirror')
            .exclude(proveedor__isnull=True)
            .exclude(proveedor__exact='')
            .order_by('proveedor')
            .values_list('proveedor', flat=True)
            .distinct()
        )
        return Response(list(proveedores))


class PivotMetadataView(APIView):
    """Metadatos (campos, operadores, medidas) para que el frontend arme el
    formulario de filtros/pivot de Concursos sin duplicar la lista blanca."""

    permission_classes = [IsSupervisor]

    def get(self, request):
        return Response(
            {
                'dimensions': [{'field': f, 'label': label} for f, label in pivot.DIMENSION_FIELDS.items()],
                'numeric_fields': [{'field': f, 'label': label} for f, label in pivot.NUMERIC_FIELDS.items()],
                'distinct_count_fields': [
                    {'field': f, 'label': label} for f, label in pivot.DISTINCT_COUNT_FIELDS.items()
                ],
                'filter_fields': [
                    {
                        'field': f,
                        'label': label,
                        'type': pivot.FIELD_TYPES[f],
                        'operators': list(pivot.OPERATORS_BY_TYPE[pivot.FIELD_TYPES[f]].keys()),
                    }
                    for f, label in pivot.FILTER_FIELDS.items()
                ],
                'measures': [{'value': value, 'label': label} for value, label in pivot.MEASURES.items()],
            }
        )


class PivotVentaDetalleView(APIView):
    """Pivot dinamico sobre ventas_detalle (mirror) para el apartado de
    Concursos: filas/columnas configurables, condiciones de filtro
    arbitrarias y medidas de conteo/recuento distinto/suma. Solo SUPERVISOR
    (se combina con su scoping normal de proveedores/vendedores)."""

    permission_classes = [IsSupervisor]

    def post(self, request):
        body = request.data
        fecha_desde, fecha_hasta = require_fecha_range(body)

        rows = pivot.validate_rows(body.get('rows'))
        columns = pivot.validate_columns(body.get('columns'), rows)
        measure, measure_field = pivot.validate_measure(body.get('measure'), body.get('measure_field'))
        cleaned_filters = pivot.validate_filters(body.get('filters'))

        qs = VentaDetalle.objects.using('mirror').filter(fecha__gte=fecha_desde, fecha__lte=fecha_hasta)
        qs = pivot.apply_filters(qs, cleaned_filters)
        qs = apply_scoping(qs, request.user)

        result = pivot.run_pivot(qs, rows, columns, measure, measure_field)
        result['measure_label'] = pivot.MEASURES[measure]
        result['measure_field'] = measure_field
        return Response(result)


class PivotFieldValuesView(APIView):
    """Valores distintos existentes de un campo dimension (para la lista
    desplegable de valores en las condiciones de filtro del pivot). Solo
    SUPERVISOR, con el mismo scoping de proveedores/vendedores."""

    permission_classes = [IsSupervisor]

    def get(self, request):
        field = request.query_params.get('field')
        if field not in pivot.PIVOT_FIELDS:
            raise ValidationError({'field': f'Campo no permitido: {field!r}.'})

        qs = apply_scoping(VentaDetalle.objects.using('mirror'), request.user)
        values = (
            qs.exclude(**{field: None})
            .exclude(**{field: ''})
            .order_by(field)
            .values_list(field, flat=True)
            .distinct()
        )
        return Response(list(values[:1000]))


class VendedorPresupuestoListView(APIView):
    """Presupuesto por vendedor: lista (scopeada a los vendedores del
    SUPERVISOR) y upsert de un vendedor a la vez."""

    permission_classes = [IsSupervisor]

    def get(self, request):
        allowed = scoped_vendedores(request.user)
        qs = VendedorPresupuesto.objects.all()
        if allowed is not None:
            qs = qs.filter(vendedor__in=allowed)
        return Response(VendedorPresupuestoSerializer(qs, many=True).data)

    def put(self, request):
        vendedor = request.data.get('vendedor')
        monto = request.data.get('monto')
        if not vendedor:
            raise ValidationError({'vendedor': 'Este campo es obligatorio.'})

        allowed = scoped_vendedores(request.user)
        if allowed is not None and vendedor not in allowed:
            raise ValidationError({'vendedor': 'No tienes acceso a este vendedor.'})

        try:
            monto = Decimal(str(monto))
        except (InvalidOperation, TypeError):
            raise ValidationError({'monto': 'Debe ser un numero valido.'})

        obj, _ = VendedorPresupuesto.objects.update_or_create(
            vendedor=vendedor, defaults={'monto': monto, 'updated_by': request.user}
        )
        return Response(VendedorPresupuestoSerializer(obj).data)


class PivotSavedViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    """Vistas de pivot guardadas por el SUPERVISOR actual (config, no el
    resultado: se recalcula en vivo al reabrirlas)."""

    serializer_class = PivotSavedViewSerializer
    permission_classes = [IsSupervisor]

    def get_queryset(self):
        return PivotSavedView.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class VendedoresListView(APIView):
    """Lista de vendedores en la tabla `vendedores` del mirror, para el
    selector de ADMIN (asignar vendedores a un SUPERVISOR)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        vendedores = (
            Vendedor.objects.using('mirror')
            .exclude(vendedor__isnull=True)
            .exclude(vendedor__exact='')
            .order_by('vendedor')
            .values_list('vendedor', flat=True)
        )
        return Response(list(vendedores))
