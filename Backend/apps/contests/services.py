"""Logica de actualizacion de Concursos desde la base de datos espejo."""
from .models import Contest


def sync_contests_from_mirror(mirror_rows):
    """Crea o actualiza Contest a partir de filas de la BD espejo.

    `mirror_rows` es un iterable de dicts con al menos:
    external_id, name, start_date, end_date, conditions.
    """
    synced = []
    for row in mirror_rows:
        contest, _ = Contest.objects.update_or_create(
            external_id=row['external_id'],
            defaults={
                'name': row['name'],
                'start_date': row['start_date'],
                'end_date': row['end_date'],
                'conditions': row.get('conditions', ''),
            },
        )
        synced.append(contest)
    return synced
