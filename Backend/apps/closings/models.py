from django.conf import settings
from django.db import models


class Closing(models.Model):
    """Congela la informacion de un periodo para que ya no pueda modificarse."""

    period_label = models.CharField(max_length=100, help_text='Ej: 2026-08')
    closed_at = models.DateTimeField(auto_now_add=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='closings'
    )
    is_frozen = models.BooleanField(default=True)

    class Meta:
        ordering = ['-closed_at']

    def __str__(self):
        return f'Cierre {self.period_label}'
