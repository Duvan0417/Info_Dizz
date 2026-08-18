class MirrorRouter:
    """Evita que las migraciones locales toquen la base de datos espejo."""

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if db == 'mirror':
            return False
        return None
