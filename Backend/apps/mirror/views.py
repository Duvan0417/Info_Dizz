from datetime import date
from decimal import Decimal, InvalidOperation

from django.db.models import Count, Sum
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet, ReadOnlyModelViewSet

from Backend.apps.users.permissions import HasRole, IsAdmin, IsSupervisor, IsVendedor
from Backend.apps.users.scoping import apply_scoping, scoped_proveedores, scoped_vendedores

from . import pivot
from .models import (
    DiaHabil,
    MaestraCliente,
    PivotSavedView,
    PremioTier,
    ProductoPrecioSap,
    VendedorPresupuesto,
    VentaDetalle,
    Vendedor,
)
from .serializers import (
    DiaHabilSerializer,
    PivotSavedViewSerializer,
    PremioTierSerializer,
    VendedorPresupuestoSerializer,
    VentaDetalleSerializer,
)
from .utils import latest_mes_maestra, month_bounds, parse_fecha, parse_fecha_or_none, require_fecha_range


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
        result['measure_label'] = pivot.measure_label(measure, measure_field)
        result['measure_field'] = measure_field
        return Response(result)


class PivotFieldValuesView(APIView):
    """Valores distintos existentes de un campo dimension (para la lista
    desplegable de valores en las condiciones de filtro del pivot, y para la
    lista de productos que participan). Solo SUPERVISOR, con el mismo
    scoping de proveedores/vendedores.

    `?proveedor=<nombre>` acota ademas a ese proveedor puntual (ej. la lista
    de productos se recorta a los que efectivamente vende ese proveedor,
    cuando el supervisor filtra por uno especifico en Concursos)."""

    permission_classes = [IsSupervisor]

    def get(self, request):
        field = request.query_params.get('field')
        if field not in pivot.PIVOT_FIELDS:
            raise ValidationError({'field': f'Campo no permitido: {field!r}.'})

        qs = apply_scoping(VentaDetalle.objects.using('mirror'), request.user)
        proveedor = request.query_params.get('proveedor')
        if proveedor:
            qs = qs.filter(proveedor=proveedor)

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
    SUPERVISOR, o al unico vendedor de un VENDEDOR) y upsert de un vendedor a
    la vez (solo SUPERVISOR: un VENDEDOR ve su presupuesto pero no lo edita)."""

    permission_classes = [IsSupervisor | IsVendedor]

    def get(self, request):
        allowed = scoped_vendedores(request.user)
        qs = VendedorPresupuesto.objects.all()
        if allowed is not None:
            qs = qs.filter(vendedor__in=allowed)
        return Response(VendedorPresupuestoSerializer(qs, many=True).data)

    def put(self, request):
        if request.user.role != request.user.Role.SUPERVISOR:
            raise PermissionDenied('Solo un SUPERVISOR puede editar presupuestos.')

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


class PremioTierViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    """Tramos de premio por cumplimiento ({porcentaje, valor}), globales y
    compartidos entre supervisores, igual que VendedorPresupuesto. Se usan en
    Concursos para calcular cuanto gana cada vendedor segun su % de
    cumplimiento del presupuesto. Un VENDEDOR solo puede listarlos (para ver
    cuanto va ganando en sus propios concursos), nunca crearlos ni borrarlos."""

    serializer_class = PremioTierSerializer
    queryset = PremioTier.objects.all()

    def get_permissions(self):
        if self.action == 'list':
            return [(IsSupervisor | IsVendedor)()]
        return [IsSupervisor()]

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)


class PivotSavedViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    """Vistas de pivot guardadas por el SUPERVISOR actual: guardan `config` +
    el `result` congelado. `fecha_inicio`/`fecha_fin` se copian de
    config.fechaDesde/fechaHasta en cada create/update, para el seguimiento de
    concursos (accion `actualizar`)."""

    serializer_class = PivotSavedViewSerializer
    permission_classes = [IsSupervisor]

    def get_queryset(self):
        return PivotSavedView.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        config = serializer.validated_data.get('config') or {}
        serializer.save(
            owner=self.request.user,
            fecha_inicio=parse_fecha_or_none(config.get('fechaDesde')),
            fecha_fin=parse_fecha_or_none(config.get('fechaHasta')),
        )

    def perform_update(self, serializer):
        config = serializer.validated_data.get('config')
        extra = {}
        if config is not None:
            extra['fecha_inicio'] = parse_fecha_or_none(config.get('fechaDesde'))
            extra['fecha_fin'] = parse_fecha_or_none(config.get('fechaHasta'))
        serializer.save(**extra)

    @action(detail=True, methods=['post'], url_path='actualizar')
    def actualizar(self, request, pk=None):
        """Recalcula `result` con datos frescos, sin tocar el rango de fechas
        ni el resto de la configuracion guardada. Solo disponible mientras el
        concurso no este cerrado; si al actualizar ya se llego (o se paso) la
        `fecha_fin`, esta actualizacion es la ultima: queda `cerrado=True`."""
        view = self.get_object()
        if view.cerrado:
            raise ValidationError({'detail': 'Este concurso ya esta cerrado, no se puede actualizar.'})
        if not view.fecha_inicio or not view.fecha_fin:
            raise ValidationError({'detail': 'Esta tabla no tiene un rango de fechas valido para actualizar.'})

        config = view.config or {}
        rows = pivot.validate_rows([f for f in [config.get('rowField1'), config.get('rowField2')] if f])
        columns = pivot.validate_columns(config.get('columnField') or None, rows)
        measure, measure_field = pivot.validate_measure(config.get('measure'), config.get('measureField'))

        raw_filters = list(config.get('conditions') or [])
        selected_products = config.get('selectedProducts') or []
        if selected_products:
            raw_filters.append({'field': 'producto', 'operator': 'in', 'value': ','.join(selected_products)})
        proveedor_filtro = config.get('proveedorFiltro')
        if proveedor_filtro:
            raw_filters.append({'field': 'proveedor', 'operator': 'eq', 'value': proveedor_filtro})
        cleaned_filters = pivot.validate_filters(raw_filters)

        qs = VentaDetalle.objects.using('mirror').filter(fecha__gte=view.fecha_inicio, fecha__lte=view.fecha_fin)
        qs = pivot.apply_filters(qs, cleaned_filters)
        qs = apply_scoping(qs, request.user)

        result = pivot.run_pivot(qs, rows, columns, measure, measure_field)
        result['measure_label'] = pivot.measure_label(measure, measure_field)
        result['measure_field'] = measure_field

        view.result = result
        if date.today() > view.fecha_fin:
            view.cerrado = True
        view.save()

        return Response(PivotSavedViewSerializer(view).data)

    @action(detail=True, methods=['put'], url_path='presupuesto')
    def set_presupuesto(self, request, pk=None):
        """Actualiza el presupuesto de UN vendedor dentro de ESTA tabla
        unicamente: nunca toca VendedorPresupuesto (el default global) ni el
        presupuesto guardado en otras tablas, aunque compartan el mismo
        vendedor."""
        view = self.get_object()
        vendedor = request.data.get('vendedor')
        if not vendedor:
            raise ValidationError({'vendedor': 'Este campo es obligatorio.'})

        monto = request.data.get('monto')
        try:
            monto = Decimal(str(monto))
        except (InvalidOperation, TypeError):
            raise ValidationError({'monto': 'Debe ser un numero valido.'})

        presupuestos = dict(view.presupuestos or {})
        presupuestos[vendedor] = str(monto)
        view.presupuestos = presupuestos
        view.save(update_fields=['presupuestos', 'updated_at'])

        return Response(PivotSavedViewSerializer(view).data)


class VendedorConcursosView(APIView):
    """Concursos vigentes (no cerrados, con `result`) donde el vendedor
    asignado al VENDEDOR autenticado aparece entre las filas del pivot
    guardado por un SUPERVISOR. Devuelve el mismo shape que
    PivotSavedViewSerializer, pero con `result.data` recortado a unicamente
    la(s) fila(s) de ese vendedor (nunca las de sus companeros) y
    `grand_total` recalculado sobre ese subconjunto. Es la unica ventana que
    tiene un VENDEDOR sobre los concursos: sin esto no ve nada."""

    permission_classes = [IsVendedor]

    def get(self, request):
        allowed = scoped_vendedores(request.user)
        vendedor = allowed[0] if allowed else None
        if not vendedor:
            return Response([])

        views = PivotSavedView.objects.filter(cerrado=False, result__isnull=False).order_by('-updated_at')
        out = []
        for view in views:
            result = view.result or {}
            rows_fields = result.get('rows_fields') or []
            if 'vendedor_nombre' not in rows_fields:
                continue
            idx = rows_fields.index('vendedor_nombre')
            data = result.get('data') or []
            mine = [entry for entry in data if len(entry.get('row') or []) > idx and entry['row'][idx] == vendedor]
            if not mine:
                continue

            grand_total = sum(Decimal(str(entry.get('total') or 0)) for entry in mine)
            mi_presupuesto = (view.presupuestos or {}).get(vendedor)
            out.append(
                {
                    'id': view.id,
                    'name': view.name,
                    'config': view.config,
                    'result': {**result, 'data': mine, 'grand_total': float(grand_total)},
                    'presupuestos': {vendedor: mi_presupuesto} if mi_presupuesto is not None else {},
                    'fecha_inicio': view.fecha_inicio,
                    'fecha_fin': view.fecha_fin,
                    'cerrado': view.cerrado,
                }
            )
        return Response(out)


class ClientesSinVentaView(APIView):
    """Clientes asignados a los vendedores de `request.user` (maestra_clientes,
    siempre el mes mas reciente disponible — ver utils.latest_mes_maestra) que
    no tienen ninguna venta registrada ese mes. VENDEDOR ve solo sus propios
    clientes (scoped_vendedores le devuelve exactamente 1); SUPERVISOR ve la
    union de todos sus vendedores asignados (scoped_vendedores, 0 o mas — ver
    tiles de "Clientes totales"/"Sin compra" en ConcursosOverview). Con
    `?proveedor=<nombre>` el criterio se acota: clientes que no le compraron
    nada a ESE proveedor puntual (aunque le hayan comprado a otro) en vez de
    "ninguna venta de nada". Para SUPERVISOR, `?vendedor=<nombre>` (repetible)
    acota ademas a uno o varios de sus vendedores asignados en vez de la union
    de todos; nunca amplia el scope (se intersecta con scoped_vendedores)."""

    permission_classes = [IsVendedor | IsSupervisor]

    def get(self, request):
        vendedores_scope = sorted(scoped_vendedores(request.user) or [])
        vendedor_filtro = request.query_params.getlist('vendedor')
        vendedores = [v for v in vendedores_scope if v in vendedor_filtro] if vendedor_filtro else vendedores_scope

        mes = latest_mes_maestra() if vendedores_scope else None
        if not vendedores_scope or not mes:
            return Response(
                {'mes_maestra': mes, 'total_clientes': 0, 'proveedores': [], 'vendedores': [], 'clientes': []}
            )

        fecha_desde, fecha_hasta = month_bounds(mes)

        clientes_maestra = (
            MaestraCliente.objects.using('mirror')
            .filter(mes_maestra=mes, vendedor__in=vendedores)
            .exclude(cod_cliente__isnull=True)
            .exclude(cod_cliente__exact='')
            .order_by('nombre')
        )

        ventas_periodo = VentaDetalle.objects.using('mirror').filter(
            vendedor_nombre__in=vendedores, fecha__gte=fecha_desde, fecha__lte=fecha_hasta
        )

        proveedor_filtro = request.query_params.get('proveedor') or ''
        ventas_para_criterio = ventas_periodo.filter(proveedor=proveedor_filtro) if proveedor_filtro else ventas_periodo
        con_venta = set(
            ventas_para_criterio.exclude(cod_cliente__isnull=True)
            .exclude(cod_cliente__exact='')
            .values_list('cod_cliente', flat=True)
            .distinct()
        )

        clientes = [
            {
                'cod_cliente': c.cod_cliente,
                'nombre': c.nombre,
                'negocio': c.negocio,
                'direccion': c.direccion,
                'telefono': c.telefono,
                'unidad': c.unidad,
                'dia_visita': c.dia_visita,
            }
            for c in clientes_maestra
            if c.cod_cliente not in con_venta
        ]

        proveedores = list(
            ventas_periodo.exclude(proveedor__isnull=True)
            .exclude(proveedor__exact='')
            .order_by('proveedor')
            .values_list('proveedor', flat=True)
            .distinct()
        )

        return Response(
            {
                'mes_maestra': mes,
                'total_clientes': clientes_maestra.count(),
                'proveedores': proveedores,
                'vendedores': vendedores_scope,
                'clientes': clientes,
            }
        )


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


class DiasHabilesView(APIView):
    """Calendario global de dias habiles de venta (`DiaHabil`): un dia sin
    fila se asume habil, asi que esta tabla solo guarda excepciones. Lectura
    disponible para cualquier autenticado (lo va a necesitar cualquier
    proyeccion que se calcule sobre este calendario); solo ADMIN puede
    editarlo, desde Administracion."""

    def get_permissions(self):
        if self.request.method == 'PUT':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get(self, request):
        qs = DiaHabil.objects.all()
        desde = request.query_params.get('desde')
        hasta = request.query_params.get('hasta')
        if desde:
            qs = qs.filter(fecha__gte=parse_fecha('desde', desde))
        if hasta:
            qs = qs.filter(fecha__lte=parse_fecha('hasta', hasta))
        return Response(DiaHabilSerializer(qs, many=True).data)

    def put(self, request):
        dias = request.data.get('dias')
        if not isinstance(dias, list) or not dias:
            raise ValidationError({'dias': 'Debe ser una lista no vacia de {"fecha", "es_habil"}.'})

        parsed = []
        for item in dias:
            fecha_raw = item.get('fecha') if isinstance(item, dict) else None
            if not fecha_raw:
                raise ValidationError({'dias': 'Cada elemento necesita "fecha" (YYYY-MM-DD).'})
            es_habil = item.get('es_habil')
            if not isinstance(es_habil, bool):
                raise ValidationError({'dias': 'Cada elemento necesita "es_habil" (true/false).'})
            parsed.append((parse_fecha('fecha', fecha_raw), es_habil))

        for fecha, es_habil in parsed:
            DiaHabil.objects.update_or_create(fecha=fecha, defaults={'es_habil': es_habil, 'updated_by': request.user})

        fechas = [fecha for fecha, _ in parsed]
        qs = DiaHabil.objects.filter(fecha__in=fechas).order_by('fecha')
        return Response(DiaHabilSerializer(qs, many=True).data)
