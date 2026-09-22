import os

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session


os.environ.setdefault("RABBIT_DATABASE_URL", "sqlite+pysqlite:///:memory:")
# Tests use an isolated credential and must never depend on deployment secrets.
os.environ["RABBIT_ADMIN_PASSWORD"] = "rabbit-admin"

from app.database import Base, engine  # noqa: E402
from app.db_models import (  # noqa: E402
    ApplicationSetting, Attempt, DemoAttemptRecord, DemoSession, Family, FamilyGuardian,
    ImportedQuestionBank, LearnerProfile, PracticeSession, RevokedToken, RewardSetting,
    SessionQuestion, User,
)
from app.repositories import ensure_admin  # noqa: E402


Base.metadata.create_all(engine)


@pytest.fixture(autouse=True)
def reset_identity_database():
    with Session(engine) as session:
        for model in (DemoAttemptRecord, DemoSession, RevokedToken, Attempt, SessionQuestion,
                      PracticeSession, RewardSetting, ImportedQuestionBank, ApplicationSetting):
            session.execute(delete(model))
        session.execute(delete(LearnerProfile))
        session.execute(delete(FamilyGuardian))
        session.execute(delete(User))
        session.execute(delete(Family))
        session.commit()
        ensure_admin(session, os.environ["RABBIT_ADMIN_PASSWORD"])
    yield
