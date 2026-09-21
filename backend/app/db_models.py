from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


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
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    token_version: Mapped[int] = mapped_column(nullable=False, default=1)
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
