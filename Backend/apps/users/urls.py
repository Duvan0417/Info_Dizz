from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import MeView, RoleTokenObtainPairView, UserAdminViewSet

router = DefaultRouter()
router.register('admin/users', UserAdminViewSet, basename='user-admin')

urlpatterns = [
    path('login/', RoleTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
] + router.urls
