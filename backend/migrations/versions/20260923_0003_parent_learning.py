"""Allow parents to learn and store each family member's default subject.

Revision ID: 20260923_0003
Revises: 20260922_0002
"""
from alembic import op
import sqlalchemy as sa

revision = "20260923_0003"
down_revision = "20260922_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("default_subject", sa.String(80), nullable=False,
                                     server_default="math.elementary"))
    op.execute(sa.text("""
        INSERT INTO learner_profiles (user_id, family_id)
        SELECT id, family_id FROM users
        WHERE role = 'parent' AND family_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM learner_profiles WHERE learner_profiles.user_id = users.id)
    """))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM learner_profiles WHERE user_id IN (SELECT id FROM users WHERE role = 'parent')"))
    op.drop_column("users", "default_subject")
