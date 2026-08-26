from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Usuario del sistema con un rol que determina sus permisos."""

    class Role(models.TextChoices):
        PROVEEDOR = 'PROVEEDOR', 'Proveedor'
        SUPERVISOR = 'SUPERVISOR', 'Supervisor'
        DIRECTOR = 'DIRECTOR', 'Director'
        ADMIN = 'ADMIN', 'Administrador'
        VENDEDOR = 'VENDEDOR', 'Vendedor'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PROVEEDOR)

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'


class ProveedorAccess(models.Model):
    """Proveedores (columna `proveedor` del mirror) que un usuario PROVEEDOR puede ver.

    Aplica a PROVEEDOR (exactamente 1, obligatorio) y SUPERVISOR (0 o mas).
    Un PROVEEDOR/SUPERVISOR sin ninguna fila aqui no ve datos de ningun
    proveedor (no ve "todo" por defecto). DIRECTOR/ADMIN nunca se filtran
    por esto.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='proveedor_access')
    proveedor = models.CharField(max_length=150)

    class Meta:
        unique_together = [('user', 'proveedor')]
        ordering = ['proveedor']

    def __str__(self):
        return f'{self.user.username} -> {self.proveedor}'


class VendedorAccess(models.Model):
    """Vendedores (columna `vendedor_nombre` del mirror) que un SUPERVISOR
    supervisa, o el vendedor (exactamente 1) que un usuario VENDEDOR
    representa. Para SUPERVISOR se combina con ProveedorAccess con AND: solo
    ve ventas que sean a la vez de sus proveedores asignados Y de sus
    vendedores asignados. Sin ninguno asignado aqui, no ve nada por esta
    dimension (mismo criterio que ProveedorAccess). Solo aplica a SUPERVISOR
    y VENDEDOR.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vendedor_access')
    vendedor = models.CharField(max_length=150)

    class Meta:
        unique_together = [('user', 'vendedor')]
        ordering = ['vendedor']

    def __str__(self):
        return f'{self.user.username} -> {self.vendedor}'
