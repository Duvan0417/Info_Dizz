"""Motor de pivot dinamico sobre VentaDetalle (mirror), para el apartado de
Concursos de SUPERVISOR: filas/columnas configurables, condiciones de filtro
arbitrarias (dentro de una lista blanca de campos) y medidas de conteo,
recuento distinto o suma.
"""
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db.models import Count, Sum
from rest_framework.exceptions import ValidationError

# Dimensiones categoricas: se pueden usar como fila, columna o filtro.
DIMENSION_FIELDS = {
    'vendedor_nombre': 'Vendedor',
    'proveedor': 'Proveedor',
    'producto': 'Producto',
    'cod_producto': 'Codigo de producto',
    'ciudad': 'Ciudad',
    'nom_cliente': 'Cliente',
    'nit_cliente': 'NIT cliente',
    'cod_cliente': 'Codigo de cliente',
    'unidad_medida': 'Unidad de medida',
    'tipologia_cliente': 'Tipologia de cliente',
    'alm': 'Almacen',
}

# Campos numericos: solo se pueden usar como filtro o medida (suma). Los de
# venta primero: son los de mayor interes para la medida "Suma".
NUMERIC_FIELDS = {
    'line_total_final': 'Venta neta',
    'venta_bruta': 'Venta bruta',
    'total_cant_final': 'Cantidad neta',
    'cantidad': 'Cantidad',
    'total_iva_final': 'IVA neto',
    'iva': 'IVA',
}

# Campos adicionales, solo filtrables (no como fila/columna del pivot).
EXTRA_FILTER_FIELDS = {
    'numero_documento': 'Numero de documento',
}

DATE_FIELDS = {'fecha': 'Fecha'}

# Campos permitidos como fila/columna del pivot.
PIVOT_FIELDS = dict(DIMENSION_FIELDS)

# Campos permitidos para la medida "recuento distinto".
DISTINCT_COUNT_FIELDS = {**DIMENSION_FIELDS, **EXTRA_FILTER_FIELDS}

# Todos los campos que se pueden usar en una condicion de filtro.
FILTER_FIELDS = {**DIMENSION_FIELDS, **NUMERIC_FIELDS, **EXTRA_FILTER_FIELDS, **DATE_FIELDS}

FIELD_TYPES = {
    **{field: 'text' for field in DIMENSION_FIELDS},
    **{field: 'numeric' for field in NUMERIC_FIELDS},
    'numero_documento': 'numeric',
    'fecha': 'date',
}

TEXT_OPERATORS = {'eq': 'exact', 'icontains': 'icontains', 'in': 'in'}
NUMERIC_OPERATORS = {'eq': 'exact', 'gt': 'gt', 'gte': 'gte', 'lt': 'lt', 'lte': 'lte'}
DATE_OPERATORS = dict(NUMERIC_OPERATORS)

OPERATORS_BY_TYPE = {
    'text': TEXT_OPERATORS,
    'numeric': NUMERIC_OPERATORS,
    'date': DATE_OPERATORS,
}

MEASURES = {
    'count': 'Conteo de lineas',
    'distinct_count': 'Recuento distinto',
    'sum': 'Suma',
}

# Campos de cliente: un "recuento distinto" sobre alguno de estos cuenta
# clientes distintos alcanzados, no una venta, asi que la medida se etiqueta
# "Impactos" en vez de "Recuento distinto" (ver measure_label()).
CLIENTE_FIELDS = {'nom_cliente', 'nit_cliente', 'cod_cliente'}


def measure_label(measure, measure_field):
    """Etiqueta legible de la medida para mostrar en el pivot (se guarda tal
    cual en `result.measure_label` al crear/actualizar una tabla)."""
    if measure == 'distinct_count' and measure_field in CLIENTE_FIELDS:
        return 'Impactos'
    return MEASURES[measure]

ROW_LIMIT = 300
COLUMN_LIMIT = 60
RAW_LIMIT = 20000

NO_COLUMN_KEY = '_'


def _coerce_value(field, raw_value):
    field_type = FIELD_TYPES[field]
    try:
        if field_type == 'numeric':
            return Decimal(str(raw_value))
        if field_type == 'date':
            return date.fromisoformat(str(raw_value))
        return str(raw_value)
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError({'filters': f'Valor invalido para "{field}": {raw_value!r}.'})


def validate_filters(raw_filters):
    """Valida y normaliza la lista de condiciones enviada por el cliente.

    Cada condicion es {field, operator, value}; `field` y `operator` deben
    pertenecer a la lista blanca (FILTER_FIELDS / OPERATORS_BY_TYPE) para
    evitar construir lookups arbitrarios sobre el modelo.
    """
    if raw_filters is None:
        return []
    if not isinstance(raw_filters, list):
        raise ValidationError({'filters': 'Debe ser una lista de condiciones.'})

    cleaned = []
    for item in raw_filters:
        if not isinstance(item, dict):
            raise ValidationError({'filters': 'Cada condicion debe ser un objeto {field, operator, value}.'})

        field = item.get('field')
        operator = item.get('operator')
        value = item.get('value')

        if field not in FILTER_FIELDS:
            raise ValidationError({'filters': f'Campo no permitido: {field!r}.'})

        operators = OPERATORS_BY_TYPE[FIELD_TYPES[field]]
        if operator not in operators:
            raise ValidationError({'filters': f'Operador no permitido para "{field}": {operator!r}.'})

        if value in (None, ''):
            raise ValidationError({'filters': f'Falta el valor de la condicion sobre "{field}".'})

        if operator == 'in':
            values = [v.strip() for v in str(value).split(',') if v.strip()]
            if not values:
                raise ValidationError({'filters': f'Falta el valor de la condicion sobre "{field}".'})
            cleaned.append({'field': field, 'lookup': 'in', 'value': values})
        else:
            cleaned.append({'field': field, 'lookup': operators[operator], 'value': _coerce_value(field, value)})

    return cleaned


def apply_filters(qs, cleaned_filters):
    for condition in cleaned_filters:
        qs = qs.filter(**{f"{condition['field']}__{condition['lookup']}": condition['value']})
    return qs


def validate_dimension(field, param_name):
    if field not in PIVOT_FIELDS:
        raise ValidationError({param_name: f'Campo no permitido: {field!r}.'})
    return field


def validate_rows(raw_rows):
    if not isinstance(raw_rows, list) or not (1 <= len(raw_rows) <= 2):
        raise ValidationError({'rows': 'Debes indicar 1 o 2 campos de fila.'})
    rows = [validate_dimension(field, 'rows') for field in raw_rows]
    if len(set(rows)) != len(rows):
        raise ValidationError({'rows': 'Los campos de fila no pueden repetirse.'})
    return rows


def validate_columns(raw_columns, rows):
    if not raw_columns:
        return None
    columns = validate_dimension(raw_columns, 'columns')
    if columns in rows:
        raise ValidationError({'columns': 'El campo de columnas no puede repetir un campo de fila.'})
    return columns


def validate_measure(measure, measure_field):
    if measure not in MEASURES:
        raise ValidationError({'measure': f'Medida no permitida: {measure!r}.'})
    if measure == 'count':
        return measure, None

    if not measure_field:
        raise ValidationError({'measure_field': 'Este campo es obligatorio para esta medida.'})
    if measure == 'distinct_count' and measure_field not in DISTINCT_COUNT_FIELDS:
        raise ValidationError({'measure_field': f'Campo no permitido: {measure_field!r}.'})
    if measure == 'sum' and measure_field not in NUMERIC_FIELDS:
        raise ValidationError({'measure_field': f'Campo no permitido: {measure_field!r}.'})
    return measure, measure_field


def _aggregate_expr(measure, measure_field):
    if measure == 'count':
        return Count('numero_linea')
    if measure == 'distinct_count':
        return Count(measure_field, distinct=True)
    return Sum(measure_field)


def run_pivot(qs, rows, columns, measure, measure_field):
    """Ejecuta la agregacion agrupada en la BD y arma la matriz de pivot en
    Python. Limita filas/columnas devueltas (ordenadas por total desc) para
    no construir respuestas enormes sobre una tabla espejo sin indices por
    dimension."""
    group_fields = list(rows) + ([columns] if columns else [])
    grouped = qs.values(*group_fields).annotate(value=_aggregate_expr(measure, measure_field))
    raw_rows = list(grouped[: RAW_LIMIT + 1])
    raw_truncated = len(raw_rows) > RAW_LIMIT
    raw_rows = raw_rows[:RAW_LIMIT]

    row_totals = {}
    row_values = {}
    column_totals = {}
    grand_total = 0

    for entry in raw_rows:
        row_key = tuple(entry[field] if entry[field] not in (None, '') else '(sin dato)' for field in rows)
        # Sum(measure_field) sobre un DecimalField (ej. line_total_final)
        # devuelve Decimal, no serializable por el encoder JSON por defecto
        # de Django (lo que crashea PivotSavedViewSet.actualizar al guardar
        # `result` en el JSONField): se convierte a float apenas se extrae,
        # asi toda la acumulacion de abajo (totales por fila/columna/general)
        # ya queda en tipos nativos de JSON.
        value = entry['value'] or 0
        if isinstance(value, Decimal):
            value = float(value)
        col_value = (entry[columns] if entry[columns] not in (None, '') else '(sin dato)') if columns else NO_COLUMN_KEY

        row_values.setdefault(row_key, {})
        row_values[row_key][col_value] = row_values[row_key].get(col_value, 0) + value
        row_totals[row_key] = row_totals.get(row_key, 0) + value
        column_totals[col_value] = column_totals.get(col_value, 0) + value
        grand_total += value

    ordered_row_keys = sorted(row_totals, key=lambda k: row_totals[k], reverse=True)
    rows_truncated = len(ordered_row_keys) > ROW_LIMIT
    ordered_row_keys = ordered_row_keys[:ROW_LIMIT]

    if columns:
        ordered_columns = sorted(column_totals, key=lambda c: column_totals[c], reverse=True)
        columns_truncated = len(ordered_columns) > COLUMN_LIMIT
        ordered_columns = ordered_columns[:COLUMN_LIMIT]
    else:
        ordered_columns = []
        columns_truncated = False

    data = []
    for row_key in ordered_row_keys:
        values = row_values[row_key]
        data.append(
            {
                'row': list(row_key),
                'values': {col: values.get(col, 0) for col in ordered_columns} if columns else None,
                'value': None if columns else values.get(NO_COLUMN_KEY, 0),
                'total': row_totals[row_key],
            }
        )

    return {
        'rows_fields': rows,
        'columns_field': columns,
        'column_values': ordered_columns,
        'column_totals': {col: column_totals[col] for col in ordered_columns} if columns else {},
        'data': data,
        'grand_total': grand_total,
        'truncated': raw_truncated or rows_truncated or columns_truncated,
    }
