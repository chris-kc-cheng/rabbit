"""Create family and identity tables.

Revision ID: 20260921_0001
Revises:
Create Date: 2026-09-21
"""

from alembic import op
import sqlalchemy as sa


revision = "20260921_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "families",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("jurisdiction", sa.String(length=2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("family_id", sa.String(length=32), nullable=True),
        sa.Column("role", sa.String(length=12), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("disabled", sa.Boolean(), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'parent', 'learner')", name="ck_users_role"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "family_id", name="uq_users_id_family"),
        sa.UniqueConstraint("username"),
    )
    op.create_index(op.f("ix_users_family_id"), "users", ["family_id"])
    op.create_table(
        "family_guardians",
        sa.Column("family_id", sa.String(length=32), nullable=False),
        sa.Column("guardian_user_id", sa.String(length=32), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["guardian_user_id", "family_id"], ["users.id", "users.family_id"],
            name="fk_guardian_user_family", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("family_id", "guardian_user_id"),
        sa.UniqueConstraint("guardian_user_id", name="uq_guardian_one_family"),
    )
    op.create_table(
        "learner_profiles",
        sa.Column("user_id", sa.String(length=32), nullable=False),
        sa.Column("family_id", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["user_id", "family_id"], ["users.id", "users.family_id"],
            name="fk_learner_user_family", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(op.f("ix_learner_profiles_family_id"), "learner_profiles", ["family_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_learner_profiles_family_id"), table_name="learner_profiles")
    op.drop_table("learner_profiles")
    op.drop_table("family_guardians")
    op.drop_index(op.f("ix_users_family_id"), table_name="users")
    op.drop_table("users")
    op.drop_table("families")
