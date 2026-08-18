def scoped_proveedores(user):
    """Proveedores que `user` puede ver, o None si no aplica restriccion.

    Restringe PROVEEDOR (exactamente 1 proveedor, ver set_proveedores) y
    SUPERVISOR (puede tener varios). DIRECTOR devuelve None (sin filtro: ve
    todo). Un usuario restringido sin ProveedorAccess asignado devuelve una
    lista vacia, que al usarse en `proveedor__in=[]` no trae ninguna fila (no
    ve "todo" por defecto).
    """
    if user.role not in (user.Role.PROVEEDOR, user.Role.SUPERVISOR):
        return None
    return list(user.proveedor_access.values_list('proveedor', flat=True))


def scoped_vendedores(user):
    """Vendedores que `user` puede ver, o None si no aplica restriccion.

    Solo restringe SUPERVISOR. Se combina con scoped_proveedores() con AND:
    un SUPERVISOR sin VendedorAccess asignado no ve nada por esta dimension
    (mismo criterio que scoped_proveedores).
    """
    if user.role != user.Role.SUPERVISOR:
        return None
    return list(user.vendedor_access.values_list('vendedor', flat=True))


def apply_scoping(qs, user, proveedor_field='proveedor', vendedor_field='vendedor_nombre'):
    """Aplica scoped_proveedores()/scoped_vendedores() (combinados con AND)
    sobre un queryset que tenga esos campos. Atajo para no repetir el mismo
    par de `if ... is not None: qs = qs.filter(...)` en cada vista."""
    allowed_proveedores = scoped_proveedores(user)
    if allowed_proveedores is not None:
        qs = qs.filter(**{f'{proveedor_field}__in': allowed_proveedores})

    allowed_vendedores = scoped_vendedores(user)
    if allowed_vendedores is not None:
        qs = qs.filter(**{f'{vendedor_field}__in': allowed_vendedores})

    return qs
