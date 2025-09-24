"""initial schema"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=100), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("is_admin", sa.Boolean(), nullable=False, default=False),
        sa.Column("full_name", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "drivers",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("cpf", sa.String(length=14), nullable=False, unique=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("weekly_rate", sa.Numeric(10, 2), nullable=False),
        sa.Column("commission_pct", sa.Numeric(4, 3), nullable=False, default=0),
        sa.Column("deposit_held", sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "INACTIVE", "SUSPENDED", name="driver_status"),
            nullable=False,
            default="ACTIVE",
        ),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("weekly_rate >= 0", name="ck_driver_weekly_rate_positive"),
        sa.CheckConstraint("commission_pct >= 0 AND commission_pct <= 1", name="ck_driver_commission_pct_range"),
        sa.CheckConstraint("deposit_held >= 0", name="ck_driver_deposit_positive"),
    )

    op.create_table(
        "vendors",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "type",
            sa.Enum("DEALER", "MECHANIC", "AUCTION", "PARTS", "SERVICE", "OTHER", name="vendor_type"),
            nullable=False,
            default="OTHER",
        ),
        sa.Column("phone", sa.String(length=20), nullable=True),
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

    op.create_table(
        "vehicles",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("plate", sa.String(length=10), nullable=False, unique=True),
        sa.Column("renavam", sa.String(length=20), nullable=False, unique=True),
        sa.Column("vin", sa.String(length=20), nullable=False, unique=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("make", sa.String(length=50), nullable=False),
        sa.Column("model", sa.String(length=50), nullable=False),
        sa.Column("color", sa.String(length=30), nullable=True),
        sa.Column("acquisition_date", sa.Date(), nullable=False),
        sa.Column("acquisition_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("sale_date", sa.Date(), nullable=True),
        sa.Column("sale_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("sale_fees", sa.Numeric(12, 2), nullable=True),
        sa.Column("current_driver_id", sa.String(length=12), sa.ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("odometer_in", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            sa.Enum("STOCK", "RENTED", "SOLD", name="vehicle_status"),
            nullable=False,
            default="STOCK",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("acquisition_price >= 0", name="ck_vehicle_acquisition_price_positive"),
        sa.CheckConstraint("sale_price >= 0", name="ck_vehicle_sale_price_positive"),
        sa.CheckConstraint("sale_fees >= 0", name="ck_vehicle_sale_fees_positive"),
    )
    op.create_index("ix_vehicle_make_model", "vehicles", ["make", "model"], unique=False)

    op.create_table(
        "expenses",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("vehicle_id", sa.String(length=12), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("vendor_id", sa.String(length=12), sa.ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "category",
            sa.Enum(
                "Parts",
                "Repair",
                "Towing",
                "Docs",
                "AuctionFee",
                "Transfer",
                "Inspection",
                "Other",
                name="expense_category",
            ),
            nullable=False,
        ),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("invoice_no", sa.String(length=50), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("paid_with", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("amount >= 0", name="ck_expense_amount_positive"),
    )
    op.create_index("ix_expense_vehicle_date", "expenses", ["vehicle_id", "date"], unique=False)

    op.create_table(
        "rentals",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("vehicle_id", sa.String(length=12), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("driver_id", sa.String(length=12), sa.ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("weekly_rate", sa.Numeric(10, 2), nullable=False),
        sa.Column("deposit", sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column(
            "billing_day",
            sa.Enum("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", name="billing_day"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("Active", "Paused", "Closed", name="rental_status"),
            nullable=False,
            default="Active",
        ),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("weekly_rate >= 0", name="ck_rental_weekly_rate_positive"),
        sa.CheckConstraint("deposit >= 0", name="ck_rental_deposit_positive"),
    )
    op.create_index("ix_rental_status", "rentals", ["status"], unique=False)

    op.create_table(
        "rent_payments",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("rental_id", sa.String(length=12), sa.ForeignKey("rentals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("weekly_rate", sa.Numeric(10, 2), nullable=False),
        sa.Column("weeks", sa.Integer(), nullable=False, default=1),
        sa.Column("due_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("paid_amount", sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("late_fee", sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column("method", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("weeks > 0", name="ck_rentpayment_weeks_positive"),
        sa.CheckConstraint("due_amount >= 0", name="ck_rentpayment_due_positive"),
        sa.CheckConstraint("paid_amount >= 0", name="ck_rentpayment_paid_positive"),
        sa.CheckConstraint("late_fee >= 0", name="ck_rentpayment_late_fee_positive"),
    )
    op.create_index("ix_rent_payment_period", "rent_payments", ["period_start", "period_end"], unique=False)

    op.create_table(
        "capital_entries",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("partner", sa.String(length=100), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "type",
            sa.Enum("Contribution", "Withdrawal", name="capital_type"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("amount >= 0", name="ck_capital_amount_positive"),
    )

    op.create_table(
        "cash_txns",
        sa.Column("id", sa.String(length=12), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("type", sa.Enum("Inflow", "Outflow", name="cash_type"), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", sa.String(length=50), nullable=True),
        sa.Column("related_vehicle_id", sa.String(length=12), sa.ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_rental_id", sa.String(length=12), sa.ForeignKey("rentals.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("amount >= 0", name="ck_cash_amount_positive"),
    )


def downgrade() -> None:
    op.drop_table("cash_txns")
    op.drop_table("capital_entries")
    op.drop_index("ix_rent_payment_period", table_name="rent_payments")
    op.drop_table("rent_payments")
    op.drop_index("ix_rental_status", table_name="rentals")
    op.drop_table("rentals")
    op.drop_index("ix_expense_vehicle_date", table_name="expenses")
    op.drop_table("expenses")
    op.drop_index("ix_vehicle_make_model", table_name="vehicles")
    op.drop_table("vehicles")
    op.drop_table("vendors")
    op.drop_table("drivers")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

