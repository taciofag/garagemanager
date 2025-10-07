"""add user avatar"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0007_user_avatar"
down_revision = "0006_cash_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_path", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_path")
