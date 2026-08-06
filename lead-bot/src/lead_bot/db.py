from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from lead_bot.config import get_settings


class Base(DeclarativeBase):
    pass


def _make_engine():
    settings = get_settings()
    url = settings.database_url
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    engine = create_engine(url, future=True, connect_args=connect_args)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _fk(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@event.listens_for(Session, "before_flush")
def _protect_append_only(session: Session, _flush_context, _instances) -> None:
    from lead_bot.models import (
        AuditEvent,
        FeedbackEvent,
        OutcomeSnapshot,
        ReviewAction,
        ScorerRun,
        ShadowPrediction,
    )

    protected = (
        AuditEvent,
        FeedbackEvent,
        ReviewAction,
        OutcomeSnapshot,
        ScorerRun,
        ShadowPrediction,
    )
    if any(isinstance(obj, protected) for obj in session.deleted):
        raise ValueError("Compliance audit and feedback records are append-only")
    if any(
        isinstance(obj, protected) and session.is_modified(obj, include_collections=False)
        for obj in session.dirty
    ):
        raise ValueError("Compliance audit and feedback records are append-only")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    from lead_bot import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
