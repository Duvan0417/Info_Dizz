from rest_framework.routers import DefaultRouter

from .views import ClosingViewSet

router = DefaultRouter()
router.register('', ClosingViewSet, basename='closing')

urlpatterns = router.urls
