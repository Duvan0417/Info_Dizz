from rest_framework.viewsets import ModelViewSet

from Backend.apps.users.permissions import IsDirector, IsSupervisor

from .models import Closing
from .serializers import ClosingSerializer


class ClosingViewSet(ModelViewSet):
    """Solo Supervisor o Director pueden crear/consultar cierres."""

    queryset = Closing.objects.all()
    serializer_class = ClosingSerializer
    permission_classes = [IsSupervisor | IsDirector]

    def perform_create(self, serializer):
        serializer.save(closed_by=self.request.user)
