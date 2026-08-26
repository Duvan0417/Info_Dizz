import calendar
from datetime import date

from django.db.models import Max
from rest_framework.exceptions import ValidationError


def parse_fecha(param, value):
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({param: f'"{value}" no es una fecha valida. Formato esperado: YYYY-MM-DD.'})


def parse_fecha_or_none(value):
    """Como parse_fecha, pero para campos opcionales (ej. fechas dentro de un
    JSONField de config): sin valor devuelve None en vez de exigirlo."""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({'config': f'"{value}" no es una fecha valida. Formato esperado: YYYY-MM-DD.'})


def require_fecha_range(params):
    """fecha_desde y fecha_hasta obligatorios (rango acotado sobre ventas_detalle,
    que no tiene indice en `fecha` y puede tener millones de filas)."""
    fecha_desde = params.get('fecha_desde')
    fecha_hasta = params.get('fecha_hasta')
    errors = {}
    if not fecha_desde:
        errors['fecha_desde'] = 'Este filtro es obligatorio.'
    if not fecha_hasta:
        errors['fecha_hasta'] = 'Este filtro es obligatorio.'
    if errors:
        raise ValidationError(errors)
    return parse_fecha('fecha_desde', fecha_desde), parse_fecha('fecha_hasta', fecha_hasta)


def latest_mes_maestra():
    """Mes (YYYYMM) mas reciente cargado en maestra_clientes, o None si esta
    vacia. Es el ultimo mes que efectivamente sincronizo el proceso externo
    que llena la base espejo, no el mes calendario de hoy: asi el reporte de
    "Clientes sin venta" (ClientesSinVentaView) sigue mostrando datos aunque
    ese proceso todavia no haya cargado el mes nuevo el dia 1, y pasa solo al
    mes siguiente cuando esa carga realmente llega."""
    from .models import MaestraCliente

    return MaestraCliente.objects.using('mirror').aggregate(Max('mes_maestra'))['mes_maestra__max']


def month_bounds(mes_maestra):
    """(primer dia, ultimo dia) del mes YYYYMM de `mes_maestra`."""
    year, month = int(mes_maestra[:4]), int(mes_maestra[4:6])
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)
