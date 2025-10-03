from collections.abc import AsyncGenerator
import ssl

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from .config import settings

Base = declarative_base()

# Usa as CAs do sistema (precisa do pacote ca-certificates na imagem)
ssl_ctx = ssl.create_default_context()

_engine = create_async_engine(
    settings.database_url,          # SEM &ssl=true na URL
    echo=False,
    future=True,
    pool_pre_ping=True,             # mata conexão morta antes de usar
    pool_recycle=300,               # recicla antes do wait_timeout do host
    pool_size=5,
    max_overflow=10,
    pool_use_lifo=True,             # reusa conexões mais novas
    connect_args={
        "ssl": ssl_ctx,             # <- TLS correto para aiomysql
        "connect_timeout": 10,
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=_engine,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
    class_=AsyncSession,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

async def init_db() -> None:
    # Alembic gerencia migrações; safeguard p/ testes/ad-hoc.
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def warm_db() -> None:
    # Aquece o pool pra 1ª request não “pagar” a conexão
    async with _engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

async def dispose_engine() -> None:
    await _engine.dispose()

__all__ = [
    "Base", "AsyncSession", "AsyncSessionLocal",
    "get_db", "init_db", "warm_db", "dispose_engine",
]
