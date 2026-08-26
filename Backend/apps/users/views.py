from django.contrib.auth import get_user_model
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import ProveedorAccess, VendedorAccess
from .permissions import IsAdmin
from .serializers import (
    RoleTokenObtainPairSerializer,
    UserAdminSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

User = get_user_model()


class RoleTokenObtainPairView(TokenObtainPairView):
    """Login: devuelve access/refresh token con el rol embebido."""

    serializer_class = RoleTokenObtainPairSerializer


class MeView(RetrieveAPIView):
    """Devuelve el usuario autenticado actual (para AuthContext en el frontend)."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    """Usuarios y sus proveedores asignados: listar, crear, editar, eliminar
    y asignar proveedores. Solo rol ADMIN."""

    queryset = User.objects.all().order_by('username')
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserAdminSerializer

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise ValidationError('No puedes eliminar tu propia cuenta.')
        instance.delete()

    @action(detail=True, methods=['put'], url_path='proveedores')
    def set_proveedores(self, request, pk=None):
        """Reemplaza por completo el set de proveedores asignados a este usuario.

        PROVEEDOR: exactamente 1 proveedor, obligatorio. SUPERVISOR: puede
        tener varios (0 o mas). Otros roles no usan esta asignacion.
        """
        user = self.get_object()
        proveedores = request.data.get('proveedores')
        if not isinstance(proveedores, list) or not all(isinstance(p, str) for p in proveedores):
            raise ValidationError({'proveedores': 'Debe ser una lista de nombres de proveedor (strings).'})

        unique_proveedores = list(dict.fromkeys(p for p in proveedores if p))

        if user.role == User.Role.PROVEEDOR and len(unique_proveedores) != 1:
            raise ValidationError({'proveedores': 'Un usuario PROVEEDOR debe tener exactamente un proveedor asignado.'})

        ProveedorAccess.objects.filter(user=user).delete()
        ProveedorAccess.objects.bulk_create(
            [ProveedorAccess(user=user, proveedor=p) for p in unique_proveedores]
        )
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=['put'], url_path='vendedores')
    def set_vendedores(self, request, pk=None):
        """Reemplaza por completo el set de vendedores asignados a este
        usuario. SUPERVISOR: 0 o mas (se combina con AND junto a proveedores
        para filtrar que ventas puede ver). VENDEDOR: exactamente 1
        (identifica cual es su propia fila de ventas; no se combina con
        proveedores)."""
        user = self.get_object()
        if user.role not in (User.Role.SUPERVISOR, User.Role.VENDEDOR):
            raise ValidationError({'vendedores': 'Solo se puede asignar vendedores a un usuario SUPERVISOR o VENDEDOR.'})

        vendedores = request.data.get('vendedores')
        if not isinstance(vendedores, list) or not all(isinstance(v, str) for v in vendedores):
            raise ValidationError({'vendedores': 'Debe ser una lista de nombres de vendedor (strings).'})

        unique_vendedores = list(dict.fromkeys(v for v in vendedores if v))

        if user.role == User.Role.VENDEDOR and len(unique_vendedores) != 1:
            raise ValidationError({'vendedores': 'Un usuario VENDEDOR debe tener exactamente un vendedor asignado.'})

        VendedorAccess.objects.filter(user=user).delete()
        VendedorAccess.objects.bulk_create(
            [VendedorAccess(user=user, vendedor=v) for v in unique_vendedores]
        )
        return Response(self.get_serializer(user).data)
