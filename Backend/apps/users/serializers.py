from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']
        read_only_fields = ['id', 'role']


class UserAdminSerializer(serializers.ModelSerializer):
    """Usuario + sus proveedores/vendedores asignados, para la vista de administrador."""

    proveedores = serializers.SerializerMethodField()
    vendedores = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'proveedores', 'vendedores']

    def get_proveedores(self, obj):
        return list(obj.proveedor_access.values_list('proveedor', flat=True))

    def get_vendedores(self, obj):
        return list(obj.vendedor_access.values_list('vendedor', flat=True))


class UserCreateSerializer(serializers.ModelSerializer):
    """Crear un usuario nuevo. Solo la usa la vista de administrador (IsAdmin)."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Editar username/email/role (y opcionalmente password) de un usuario existente."""

    password = serializers.CharField(write_only=True, min_length=8, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'password']

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Incluye el rol del usuario dentro del payload del token JWT."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        return token
