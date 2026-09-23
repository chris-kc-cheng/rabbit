"""Store each learner's parent-selected practice topics.

Revision ID: 20260923_0004
Revises: 20260923_0003
"""
from alembic import op
import sqlalchemy as sa


revision = "20260923_0004"
down_revision = "20260923_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("default_topics", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("users", "default_topics")
