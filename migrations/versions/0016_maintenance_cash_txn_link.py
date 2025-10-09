"""link maintenance occurrences with cash transactions"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0016_maintenance_cash_txn_link"
down_revision = "0015_recurring_maintenance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "maintenance_occurrence",
        sa.Column("cash_txn_id", sa.String(length=12), nullable=True),
    )
    op.create_foreign_key(
        "fk_maintenance_occurrence_cash",
        "maintenance_occurrence",
        "cash_txns",
        ["cash_txn_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_maintenance_occurrence_cash_txn",
        "maintenance_occurrence",
        ["cash_txn_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_maintenance_occurrence_cash_txn", table_name="maintenance_occurrence")
    op.drop_constraint("fk_maintenance_occurrence_cash", "maintenance_occurrence", type_="foreignkey")
    op.drop_column("maintenance_occurrence", "cash_txn_id")
