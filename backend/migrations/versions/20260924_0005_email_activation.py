"""Add parent email identity and single-use account activations.

Revision ID: 20260924_0005
Revises: 20260923_0004
"""
from alembic import op
import sqlalchemy as sa


revision = "20260924_0005"
down_revision = "20260923_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(320), nullable=True))
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.execute(sa.text("UPDATE users SET email = username WHERE role = 'parent' AND username LIKE '%@%'"))
    op.create_table(
        "account_activations",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("account_activations")
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "email")
