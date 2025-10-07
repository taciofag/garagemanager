"""add rental minimum term"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0008_rental_minimum_term"
down_revision = "0007_user_avatar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "rentals",
        sa.Column("minimum_term_months", sa.Integer(), nullable=False, server_default="3"),
    )
    op.alter_column("rentals", "minimum_term_months", server_default=None)


def downgrade() -> None:
    op.drop_column("rentals", "minimum_term_months")
