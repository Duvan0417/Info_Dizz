from django.db import models


class Contest(models.Model):
    """Concurso con sus fechas y condiciones, sincronizado desde la BD espejo."""

    external_id = models.CharField(max_length=100, unique=True, help_text='ID en la base de datos espejo')
    name = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField()
    conditions = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
