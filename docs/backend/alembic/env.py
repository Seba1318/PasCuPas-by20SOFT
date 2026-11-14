"""Configurarea Alembic: de unde ia adresa bazei și schema așteptată.

Comenzi (din folderul backend/):
    uv run alembic upgrade head                          # aplică migrațiile
    uv run alembic revision --autogenerate -m "mesaj"    # migrație nouă din modele
"""

from logging.config import fileConfig

from geoalchemy2 import alembic_helpers
from sqlalchemy import engine_from_config, pool

from alembic import context
from app import config as app_config
from app import models  # noqa: F401  (înregistrează toate tabelele în Base.metadata)
from app.database import Base

config = context.config
config.set_main_option("sqlalchemy.url", app_config.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Tabelele create de extensia PostGIS, nu de noi; autogenerate nu trebuie să le șteargă.
POSTGIS_TABLES = {"spatial_ref_sys", "geometry_columns", "geography_columns"}


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table" and name in POSTGIS_TABLES:
        return False
    return alembic_helpers.include_object(obj, name, type_, reflected, compare_to)


def _configure(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        include_object=include_object,
        # render_item scrie corect coloanele Geometry în fișierul de migrație.
        render_item=alembic_helpers.render_item,
        # writer transformă create_table/create_index în variantele „geospatial”, care nu
        # creează de două ori indexul GIST al coloanelor geom.
        process_revision_directives=alembic_helpers.writer,
        compare_type=True,
        **kwargs,
    )


def run_migrations_offline() -> None:
    """Generează SQL fără conexiune (uv run alembic upgrade head --sql)."""
    _configure(url=config.get_main_option("sqlalchemy.url"), literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
