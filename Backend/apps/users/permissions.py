from rest_framework.permissions import BasePermission


class IsProveedor(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == user.Role.PROVEEDOR)


class IsSupervisor(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == user.Role.SUPERVISOR)


class IsDirector(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == user.Role.DIRECTOR)


class IsVendedor(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == user.Role.VENDEDOR)


class IsAdmin(BasePermission):
    """Rol de administracion del sistema (crear usuarios, asignar proveedores).
    Independiente de la jerarquia de negocio (Proveedor/Supervisor/Director)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == user.Role.ADMIN)


class HasRole(BasePermission):
    """Permite el acceso solo a los roles listados en `view.allowed_roles`."""

    def has_permission(self, request, view):
        allowed_roles = getattr(view, 'allowed_roles', [])
        user = request.user
        return bool(user and user.is_authenticated and user.role in allowed_roles)
