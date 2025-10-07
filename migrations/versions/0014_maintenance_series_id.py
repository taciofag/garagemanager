"""maintenance series id"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0014_maintenance_series_id"
down_revision = "0013_uppercase_maintenance_frequency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vehicle_maintenance", sa.Column("series_id", sa.String(length=12), nullable=True))
    op.create_index("ix_vehicle_maintenance_series", "vehicle_maintenance", ["series_id"])
    op.execute("UPDATE vehicle_maintenance SET series_id = id WHERE series_id IS NULL")
    op.alter_column("vehicle_maintenance", "series_id", existing_type=sa.String(length=12), nullable=False)


def downgrade() -> None:
    op.drop_index("ix_vehicle_maintenance_series", table_name="vehicle_maintenance")
    op.drop_column("vehicle_maintenance", "series_id")
