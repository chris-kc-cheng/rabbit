"""Persist practice, content, rewards, revocations, and demo state.

Revision ID: 20260922_0002
Revises: 20260921_0001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260922_0002"
down_revision = "20260921_0001"
branch_labels = None
depends_on = None

json_document = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table("practice_sessions",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("learner_id", sa.String(32), sa.ForeignKey("learner_profiles.user_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("subject", sa.String(80), nullable=False), sa.Column("seed", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_practice_sessions_learner_id", "practice_sessions", ["learner_id"])
    op.create_table("session_questions",
        sa.Column("session_id", sa.String(32), sa.ForeignKey("practice_sessions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("question_id", sa.String(180), primary_key=True), sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("public_snapshot", json_document, nullable=False), sa.Column("grading_snapshot", json_document, nullable=False))
    op.create_table("attempts",
        sa.Column("id", sa.String(32), primary_key=True), sa.Column("session_id", sa.String(32), nullable=False),
        sa.Column("question_id", sa.String(180), nullable=False),
        sa.Column("learner_id", sa.String(32), sa.ForeignKey("learner_profiles.user_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("snapshot", json_document, nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["session_id", "question_id"], ["session_questions.session_id", "session_questions.question_id"]),
        sa.UniqueConstraint("session_id", "question_id", name="uq_attempt_session_question"))
    op.create_index("ix_attempts_learner_id", "attempts", ["learner_id"])
    op.create_table("reward_settings", sa.Column("learner_id", sa.String(32), sa.ForeignKey("learner_profiles.user_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("settings", json_document, nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("imported_question_banks", sa.Column("subject", sa.String(80), primary_key=True),
        sa.Column("document", json_document, nullable=False), sa.Column("imported_by", sa.String(32), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("application_settings", sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("value", json_document, nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("revoked_tokens", sa.Column("jti", sa.String(80), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_revoked_tokens_user_id", "revoked_tokens", ["user_id"])
    op.create_table("demo_sessions", sa.Column("id", sa.String(48), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("demo_attempts", sa.Column("session_id", sa.String(48), sa.ForeignKey("demo_sessions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("question_id", sa.String(80), primary_key=True), sa.Column("response", json_document, nullable=False),
        sa.Column("result", json_document, nullable=False), sa.Column("answered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    for table in ("demo_attempts", "demo_sessions", "revoked_tokens", "application_settings", "imported_question_banks", "reward_settings", "attempts", "session_questions", "practice_sessions"):
        op.drop_table(table)
