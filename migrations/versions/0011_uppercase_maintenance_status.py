"""uppercase maintenance status enum"""
from __future__ import annotations

from alembic import op

revision = "0011_uppercase_maintenance_status"
down_revision = "0010_add_vendor_to_vehicle_maintenance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE vehicle_maintenance SET status = UPPER(status)")
    op.execute(
        "ALTER TABLE vehicle_maintenance "
        "MODIFY COLUMN status ENUM('OPEN','COMPLETED','SKIPPED') NOT NULL DEFAULT 'OPEN'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE vehicle_maintenance "
        "MODIFY COLUMN status ENUM('Open','Completed','Skipped') NOT NULL DEFAULT 'Open'"
    )
    op.execute("UPDATE vehicle_maintenance SET status = CONCAT(UPPER(SUBSTRING(status, 1, 1)), LOWER(SUBSTRING(status, 2)))")
