from __future__ import annotations

import sys
from pathlib import Path

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.config import settings
from app.db import Base
from app import models  # noqa: F401  # ensure models imported

config = context.config

def _sync_database_url(async_url: str) -> str:
    replacements = {
        "+aiosqlite": "",
        "+aiomysql": "+pymysql",
    }
    sync_url = async_url
    for needle, swap in replacements.items():
        if needle in sync_url:
            sync_url = sync_url.replace(needle, swap)
    return sync_url

config.set_main_option("sqlalchemy.url", _sync_database_url(settings.database_url))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata



def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()



def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()



if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
