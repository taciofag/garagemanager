"""recurring maintenance series"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0015_recurring_maintenance"
down_revision = "0014_maintenance_series_id"
branch_labels = None
depends_on = None


maintenance_frequency_v2 = sa.Enum(
    "monthly",
    "yearly",
    "weekly",
    "on_demand",
    name="maintenance_frequency_v2",
)

maintenance_series_status = sa.Enum(
    "active",
    "paused",
    "canceled",
    name="maintenance_series_status",
)

maintenance_occurrence_status = sa.Enum(
    "open",
    "paid",
    "ignored",
    "canceled",
    name="maintenance_occurrence_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    maintenance_frequency_v2.create(bind, checkfirst=True)
    maintenance_series_status.create(bind, checkfirst=True)
    maintenance_occurrence_status.create(bind, checkfirst=True)

    op.create_table(
        "maintenance_series",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.String(length=12), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("supplier_id", sa.String(length=12), sa.ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("frequency", maintenance_frequency_v2, nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("day_rule", sa.String(length=20), nullable=False, server_default="same_day"),
        sa.Column("status", maintenance_series_status, nullable=False, server_default="active"),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("last_generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_maintenance_series_vehicle_id", "maintenance_series", ["vehicle_id"])
    op.create_index("ix_maintenance_series_supplier_id", "maintenance_series", ["supplier_id"])
    op.create_index("ix_maintenance_series_next_due", "maintenance_series", ["next_due_date"])

    op.create_table(
        "maintenance_occurrence",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("series_id", sa.Integer(), sa.ForeignKey("maintenance_series.id", ondelete="CASCADE"), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", maintenance_occurrence_status, nullable=False, server_default="open"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("series_id", "due_date", name="uq_occurrence_series_due_date"),
    )
    op.create_index("ix_occurrence_due_date", "maintenance_occurrence", ["due_date"])
    op.create_index("ix_occurrence_status_due", "maintenance_occurrence", ["status", "due_date"])

    op.alter_column("maintenance_series", "amount", server_default=None)
    op.alter_column("maintenance_occurrence", "amount", server_default=None)
    op.alter_column("maintenance_series", "day_rule", server_default=None)
    op.alter_column("maintenance_series", "status", server_default=None)
    op.alter_column("maintenance_occurrence", "status", server_default=None)


def downgrade() -> None:
    op.alter_column("maintenance_occurrence", "status", server_default="open")
    op.alter_column("maintenance_series", "status", server_default="active")
    op.alter_column("maintenance_series", "day_rule", server_default="same_day")
    op.alter_column("maintenance_occurrence", "amount", server_default="0")
    op.alter_column("maintenance_series", "amount", server_default="0")

    op.drop_index("ix_occurrence_status_due", table_name="maintenance_occurrence")
    op.drop_index("ix_occurrence_due_date", table_name="maintenance_occurrence")
    op.drop_table("maintenance_occurrence")

    op.drop_index("ix_maintenance_series_next_due", table_name="maintenance_series")
    op.drop_index("ix_maintenance_series_supplier_id", table_name="maintenance_series")
    op.drop_index("ix_maintenance_series_vehicle_id", table_name="maintenance_series")
    op.drop_table("maintenance_series")

    bind = op.get_bind()
    maintenance_occurrence_status.drop(bind, checkfirst=True)
    maintenance_series_status.drop(bind, checkfirst=True)
    maintenance_frequency_v2.drop(bind, checkfirst=True)
