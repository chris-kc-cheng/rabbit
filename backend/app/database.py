from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


def database_url() -> str | URL:
    override = os.environ.get("RABBIT_DATABASE_URL")
    if override:
        return override
    password = os.environ.get("RABBIT_DATABASE_PASSWORD")
    if os.environ.get("RABBIT_ENV") == "production" and not password:
        raise RuntimeError("RABBIT_DATABASE_PASSWORD is required in production")
    return URL.create(
        "postgresql+psycopg",
        username=os.environ.get("RABBIT_DATABASE_USER", "rabbit"),
        password=password or "rabbit-local",
        host=os.environ.get("RABBIT_DATABASE_HOST", "localhost"),
        port=int(os.environ.get("RABBIT_DATABASE_PORT", "5432")),
        database=os.environ.get("RABBIT_DATABASE_NAME", "rabbit"),
    )


_url = database_url()
_engine_options: dict = {"pool_pre_ping": True}
if str(_url).startswith("sqlite"):
    _engine_options.update(
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

engine = create_engine(_url, **_engine_options)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
