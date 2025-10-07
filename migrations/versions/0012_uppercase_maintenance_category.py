"""uppercase maintenance category enum"""
from __future__ import annotations

from alembic import op

revision = "0012_uppercase_maintenance_category"
down_revision = "0011_uppercase_maintenance_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE vehicle_maintenance "
        "MODIFY COLUMN category ENUM('INSURANCE','TRACKER','OIL_CHANGE','TIRES','IPVA','INSPECTION','SERVICE','OTHER') "
        "NOT NULL"
    )
    op.execute("UPDATE vehicle_maintenance SET category = UPPER(REPLACE(category, ' ', '_'))")
    op.execute("UPDATE vehicle_maintenance SET category = 'OIL_CHANGE' WHERE category IN ('OILCHANGE', 'OIL_CHANGE')")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE vehicle_maintenance "
        "MODIFY COLUMN category ENUM('Insurance','Tracker','OilChange','Tires','IPVA','Inspection','Service','Other') "
        "NOT NULL"
    )
    op.execute("UPDATE vehicle_maintenance SET category = 'OilChange' WHERE category = 'OIL_CHANGE'")
    op.execute("UPDATE vehicle_maintenance SET category = CONCAT(UPPER(SUBSTRING(category, 1, 1)), LOWER(SUBSTRING(category, 2)))")
