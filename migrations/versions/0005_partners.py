"""Add partners table."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0005_partners"
down_revision = "0004_cash_links"
branch_labels = None
depends_on = None


partners_table = sa.table(
    "partners",
    sa.column("id", sa.String(length=12)),
    sa.column("name", sa.String(length=100)),
)

capital_entries_table = sa.table(
    "capital_entries",
    sa.column("partner", sa.String(length=100)),
)


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if "partners" not in inspector.get_table_names():
        op.create_table(
            "partners",
            sa.Column("id", sa.String(length=12), primary_key=True),
            sa.Column("name", sa.String(length=100), nullable=False),
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
            sa.UniqueConstraint("name", name="uq_partner_name"),
        )

    existing = conn.execute(sa.select(capital_entries_table.c.partner).distinct()).fetchall()
    names = sorted({row[0] for row in existing if row[0]})
    if names:
        existing_names = {row[0] for row in conn.execute(sa.select(partners_table.c.name)).fetchall()}
        new_names = [name for name in names if name not in existing_names]
        if new_names:
            start_index = conn.execute(sa.select(sa.func.count()).select_from(partners_table)).scalar() or 0
            rows = [
                {"id": f"PRT-{start_index + index + 1:04d}", "name": name}
                for index, name in enumerate(new_names)
            ]
            op.bulk_insert(partners_table, rows)


def downgrade() -> None:
    op.drop_table("partners")
