from django.conf import settings
from django.db import models


class VentaDetalleVal(models.Model):
    """Espejo de solo lectura de `ventas_detalle_val` (base de datos mirror)."""

    pk = models.CompositePrimaryKey('id_interno_documento', 'numero_linea')
    id_interno_documento = models.IntegerField()
    numero_linea = models.IntegerField()
    alm = models.CharField(max_length=10, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    ciudad = models.CharField(max_length=100, null=True, blank=True)
    cod_producto = models.CharField(max_length=50, null=True, blank=True)
    cod_cliente = models.CharField(max_length=50, null=True, blank=True)
    cod_transportador = models.CharField(max_length=50, null=True, blank=True)
    descuento_porcentaje = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    fecha = models.DateField(null=True, blank=True)
    id_picking = models.IntegerField(null=True, blank=True)
    indicador_impuestos = models.CharField(max_length=20, null=True, blank=True)
    iva = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    nit_cliente = models.CharField(max_length=20, null=True, blank=True)
    nom_cliente = models.CharField(max_length=200, null=True, blank=True)
    numero_documento = models.IntegerField(null=True, blank=True)
    precio_un_sin_dcto = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    producto = models.CharField(max_length=255, null=True, blank=True)
    proveedor = models.CharField(max_length=150, null=True, blank=True)
    tipologia_cliente = models.CharField(max_length=255, null=True, blank=True)
    venta_bruta = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    unidad_medida = models.CharField(max_length=20, null=True, blank=True)
    vendedor_nombre = models.CharField(max_length=150, null=True, blank=True)
    numero_ref = models.IntegerField(null=True, blank=True)
    icui = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    cant_nc = models.IntegerField(null=True, blank=True)
    line_total_nc = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    iva_nc = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    concepto_nc = models.CharField(max_length=255, null=True, blank=True)
    nc_vinculada = models.CharField(max_length=100, null=True, blank=True)
    total_cant_final = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    line_total_final = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_iva_final = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'ventas_detalle_val'
        indexes = [models.Index(fields=['vendedor_nombre'])]

    def __str__(self):
        return f'{self.id_interno_documento}-{self.numero_linea}'

    def save(self, *args, **kwargs):
        raise NotImplementedError('ventas_detalle_val es de solo lectura (espejo).')

    def delete(self, *args, **kwargs):
        raise NotImplementedError('ventas_detalle_val es de solo lectura (espejo).')


class VentaDetalle(models.Model):
    """Espejo de solo lectura de `ventas_detalle` (base de datos mirror)."""

    pk = models.CompositePrimaryKey('id_interno_documento', 'numero_linea')
    id_interno_documento = models.IntegerField()
    numero_linea = models.IntegerField()
    alm = models.CharField(max_length=10, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    ciudad = models.CharField(max_length=100, null=True, blank=True)
    cod_producto = models.CharField(max_length=50, null=True, blank=True)
    cod_cliente = models.CharField(max_length=50, null=True, blank=True)
    cod_transportador = models.CharField(max_length=50, null=True, blank=True)
    descuento_porcentaje = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    fecha = models.DateField(null=True, blank=True)
    id_picking = models.IntegerField(null=True, blank=True)
    indicador_impuestos = models.CharField(max_length=20, null=True, blank=True)
    iva = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    nit_cliente = models.CharField(max_length=20, null=True, blank=True)
    nom_cliente = models.CharField(max_length=200, null=True, blank=True)
    numero_documento = models.IntegerField(null=True, blank=True)
    precio_un_sin_dcto = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    producto = models.CharField(max_length=255, null=True, blank=True)
    proveedor = models.CharField(max_length=150, null=True, blank=True)
    tipologia_cliente = models.CharField(max_length=255, null=True, blank=True)
    venta_bruta = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    unidad_medida = models.CharField(max_length=20, null=True, blank=True)
    vendedor_nombre = models.CharField(max_length=150, null=True, blank=True)
    numero_ref = models.IntegerField(null=True, blank=True)
    icui = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    cant_nc = models.IntegerField(null=True, blank=True)
    line_total_nc = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    iva_nc = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    concepto_nc = models.CharField(max_length=255, null=True, blank=True)
    nc_vinculada = models.CharField(max_length=100, null=True, blank=True)
    total_cant_final = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    line_total_final = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_iva_final = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'ventas_detalle'
        indexes = [models.Index(fields=['vendedor_nombre'])]

    def __str__(self):
        return f'{self.id_interno_documento}-{self.numero_linea}'

    def save(self, *args, **kwargs):
        raise NotImplementedError('ventas_detalle es de solo lectura (espejo).')

    def delete(self, *args, **kwargs):
        raise NotImplementedError('ventas_detalle es de solo lectura (espejo).')


class ProductoPrecioSap(models.Model):
    """Espejo de solo lectura de `productos_precios_sap` (base de datos mirror)."""

    id = models.IntegerField(primary_key=True)
    cod_producto = models.CharField(max_length=50)
    nombre_producto = models.CharField(max_length=255)
    cod_grupo = models.CharField(max_length=20, null=True, blank=True)
    proveedor = models.CharField(max_length=150, null=True, blank=True)
    bodega = models.CharField(max_length=50, null=True, blank=True)
    precio = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    iva = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    ultima_vez_visto = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'productos_precios_sap'

    def __str__(self):
        return f'{self.cod_producto} - {self.nombre_producto}'

    def save(self, *args, **kwargs):
        raise NotImplementedError('productos_precios_sap es de solo lectura (espejo).')

    def delete(self, *args, **kwargs):
        raise NotImplementedError('productos_precios_sap es de solo lectura (espejo).')


class Vendedor(models.Model):
    """Espejo de solo lectura de `vendedores` (base de datos mirror).

    `vendedor` es el mismo valor que aparece en VentaDetalle.vendedor_nombre
    (ej. '1013-ADMINISTRATIVA'), no un nombre libre.
    """

    cod_sap = models.CharField(primary_key=True, max_length=4)
    vendedor = models.CharField(max_length=44, null=True, blank=True)
    estado = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'vendedores'

    def __str__(self):
        return self.vendedor or self.cod_sap

    def save(self, *args, **kwargs):
        raise NotImplementedError('vendedores es de solo lectura (espejo).')

    def delete(self, *args, **kwargs):
        raise NotImplementedError('vendedores es de solo lectura (espejo).')


class VendedorPresupuesto(models.Model):
    """Presupuesto de ventas asignado a un vendedor (mismo valor que aparece
    en VentaDetalle.vendedor_nombre). Se guarda en la base local (no en el
    espejo): lo edita cualquier SUPERVISOR desde el apartado de Concursos."""

    vendedor = models.CharField(max_length=150, unique=True)
    monto = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['vendedor']

    def __str__(self):
        return f'{self.vendedor}: {self.monto}'


class PivotSavedView(models.Model):
    """Tabla de pivot guardada por un SUPERVISOR en el apartado de Concursos:
    guarda tanto la configuracion (rango de fechas, filas/columnas, medida,
    condiciones) como la tabla generada (`result`, la respuesta congelada del
    endpoint de pivot al momento de guardar). El apartado de tablas guardadas
    muestra `result` tal cual; "modificar" recarga `config` en el
    constructor, se vuelve a generar y se actualiza este mismo registro."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pivot_saved_views')
    name = models.CharField(max_length=150)
    config = models.JSONField()
    result = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.owner.username}: {self.name}'
