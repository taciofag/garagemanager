"""vehicle maintenance tracking"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0009_vehicle_maintenance"
down_revision = "0008_rental_minimum_term"
branch_labels = None
depends_on = None

maintenance_category = sa.Enum(
    "INSURANCE",
    "TRACKER",
    "OIL_CHANGE",
    "TIRES",
    "IPVA",
    "INSPECTION",
    "SERVICE",
    "OTHER",
    name="maintenance_category",
)

maintenance_frequency = sa.Enum(
    "MONTHLY",
    "QUARTERLY",
    "SEMIANNUAL",
    "ANNUAL",
    "KILOMETER",
    "ON_DEMAND",
    name="maintenance_frequency",
)

maintenance_status = sa.Enum("OPEN", "COMPLETED", "SKIPPED", name="maintenance_status")


def upgrade() -> None:
    maintenance_category.create(op.get_bind(), checkfirst=True)
    maintenance_frequency.create(op.get_bind(), checkfirst=True)
    maintenance_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "vehicle_maintenance",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("vehicle_id", sa.String(length=12), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", sa.String(length=12), sa.ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("category", maintenance_category, nullable=False),
        sa.Column("frequency", maintenance_frequency, nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("odometer_due", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", maintenance_status, nullable=False, server_default="Open"),
        sa.Column("completed_at", sa.Date(), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_vehicle_maintenance_vehicle_id", "vehicle_maintenance", ["vehicle_id"])
    op.create_index("ix_vehicle_maintenance_status", "vehicle_maintenance", ["status"])
    op.create_index("ix_vehicle_maintenance_due_date", "vehicle_maintenance", ["due_date"])

    op.alter_column("vehicle_maintenance", "amount", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_vehicle_maintenance_due_date", table_name="vehicle_maintenance")
    op.drop_index("ix_vehicle_maintenance_status", table_name="vehicle_maintenance")
    op.drop_index("ix_vehicle_maintenance_vehicle_id", table_name="vehicle_maintenance")
    op.drop_table("vehicle_maintenance")

    maintenance_status.drop(op.get_bind(), checkfirst=True)
    maintenance_frequency.drop(op.get_bind(), checkfirst=True)
    maintenance_category.drop(op.get_bind(), checkfirst=True)
