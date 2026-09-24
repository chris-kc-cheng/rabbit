from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


JSON_DOCUMENT = JSON().with_variant(JSONB(), "postgresql")


class Family(Base):
    __tablename__ = "families"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    jurisdiction: Mapped[str] = mapped_column(String(2), nullable=False, default="CA")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'parent', 'learner')", name="ck_users_role"),
        UniqueConstraint("id", "family_id", name="uq_users_id_family"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    family_id: Mapped[str | None] = mapped_column(ForeignKey("families.id", ondelete="RESTRICT"), index=True)
    role: Mapped[str] = mapped_column(String(12), nullable=False)
    username: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, unique=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    token_version: Mapped[int] = mapped_column(nullable=False, default=1)
    default_subject: Mapped[str] = mapped_column(String(80), nullable=False, default="math.elementary")
    default_topics: Mapped[list[str]] = mapped_column(JSON_DOCUMENT, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AccountActivation(Base):
    __tablename__ = "account_activations"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FamilyGuardian(Base):
    __tablename__ = "family_guardians"
    __table_args__ = (
        ForeignKeyConstraint(
            ["guardian_user_id", "family_id"],
            ["users.id", "users.family_id"],
            ondelete="CASCADE",
            name="fk_guardian_user_family",
        ),
        UniqueConstraint("guardian_user_id", name="uq_guardian_one_family"),
    )

    family_id: Mapped[str] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), primary_key=True)
    guardian_user_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="guardian")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "family_id"],
            ["users.id", "users.family_id"],
            ondelete="CASCADE",
            name="fk_learner_user_family",
        ),
    )

    user_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    family_id: Mapped[str] = mapped_column(ForeignKey("families.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[User] = relationship()


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    learner_id: Mapped[str] = mapped_column(ForeignKey("learner_profiles.user_id", ondelete="RESTRICT"), index=True)
    subject: Mapped[str] = mapped_column(String(80), nullable=False)
    seed: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SessionQuestion(Base):
    __tablename__ = "session_questions"

    session_id: Mapped[str] = mapped_column(ForeignKey("practice_sessions.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[str] = mapped_column(String(180), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    public_snapshot: Mapped[dict] = mapped_column(JSON_DOCUMENT, nullable=False)
    grading_snapshot: Mapped[dict] = mapped_column(JSON_DOCUMENT, nullable=False)


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("practice_sessions.id", ondelete="RESTRICT"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(180), nullable=False)
    learner_id: Mapped[str] = mapped_column(ForeignKey("learner_profiles.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    snapshot: Mapped[dict] = mapped_column(JSON_DOCUMENT, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(["session_id", "question_id"], ["session_questions.session_id", "session_questions.question_id"]),
        UniqueConstraint("session_id", "question_id", name="uq_attempt_session_question"),
    )


class RewardSetting(Base):
    __tablename__ = "reward_settings"
    learner_id: Mapped[str] = mapped_column(ForeignKey("learner_profiles.user_id", ondelete="CASCADE"), primary_key=True)
    settings: Mapped[dict] = mapped_column(JSON_DOCUMENT, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ImportedQuestionBank(Base):
    __tablename__ = "imported_question_banks"
    subject: Mapped[str] = mapped_column(String(80), primary_key=True)
    document: Mapped[dict] = mapped_column(JSON_DOCUMENT, nullable=False)
    imported_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ApplicationSetting(Base):
    __tablename__ = "application_settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON_DOCUMENT, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    jti: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DemoSession(Base):
    __tablename__ = "demo_sessions"
    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DemoAttemptRecord(Base):
    __tablename__ = "demo_attempts"
    session_id: Mapped[str] = mapped_column(ForeignKey("demo_sessions.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    response: Mapped[dict] = mapped_column(JSON_DOCUMENT, nullable=False)
    result: Mapped[dict] = mapped_column(JSON_DOCUMENT, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
