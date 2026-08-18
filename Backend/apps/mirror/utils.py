from datetime import date

from rest_framework.exceptions import ValidationError


def parse_fecha(param, value):
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({param: f'"{value}" no es una fecha valida. Formato esperado: YYYY-MM-DD.'})


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
