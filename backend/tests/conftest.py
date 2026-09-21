import os

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session


os.environ.setdefault("RABBIT_DATABASE_URL", "sqlite+pysqlite:///:memory:")

from app.database import Base, engine  # noqa: E402
from app.db_models import Family, FamilyGuardian, LearnerProfile, User  # noqa: E402
from app.repositories import ensure_admin  # noqa: E402


Base.metadata.create_all(engine)


@pytest.fixture(autouse=True)
def reset_identity_database():
    with Session(engine) as session:
        session.execute(delete(LearnerProfile))
        session.execute(delete(FamilyGuardian))
        session.execute(delete(User))
        session.execute(delete(Family))
        session.commit()
        ensure_admin(session, "rabbit-admin")
    yield
