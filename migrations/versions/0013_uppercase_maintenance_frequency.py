"""uppercase maintenance frequency enum"""
from __future__ import annotations

from alembic import op

revision = "0013_uppercase_maintenance_frequency"
down_revision = "0012_uppercase_maintenance_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE vehicle_maintenance "
        "MODIFY COLUMN frequency ENUM('MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','KILOMETER','ON_DEMAND') "
        "NULL"
    )
    op.execute("UPDATE vehicle_maintenance SET frequency = UPPER(REPLACE(frequency, ' ', '_')) WHERE frequency IS NOT NULL")
    op.execute("UPDATE vehicle_maintenance SET frequency = 'SEMIANNUAL' WHERE frequency IN ('SEMIANNUAL', 'Semiannual')")
    op.execute("UPDATE vehicle_maintenance SET frequency = 'ON_DEMAND' WHERE frequency IN ('ONDEMAND', 'OnDemand')")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE vehicle_maintenance "
        "MODIFY COLUMN frequency ENUM('Monthly','Quarterly','Semiannual','Annual','Kilometer','OnDemand') NULL"
    )
    op.execute("UPDATE vehicle_maintenance SET frequency = 'Semiannual' WHERE frequency = 'SEMIANNUAL'")
    op.execute("UPDATE vehicle_maintenance SET frequency = 'OnDemand' WHERE frequency = 'ON_DEMAND'")
    op.execute("UPDATE vehicle_maintenance SET frequency = CONCAT(UPPER(SUBSTRING(frequency, 1, 1)), LOWER(SUBSTRING(frequency, 2))) WHERE frequency IS NOT NULL")
