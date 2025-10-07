"""cash categories and category references"""
from __future__ import annotations

import re
from typing import Dict

from alembic import op
import sqlalchemy as sa

revision = "0006_cash_categories"
down_revision = "0005_partners"
branch_labels = None
depends_on = None

_slug_pattern = re.compile(r"[^a-z0-9]+")


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = _slug_pattern.sub("-", value)
    return value.strip("-")


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if "cash_categories" not in inspector.get_table_names():
        op.create_table(
            "cash_categories",
            sa.Column("id", sa.String(length=12), primary_key=True),
            sa.Column("name", sa.String(length=80), nullable=False, unique=True),
            sa.Column("slug", sa.String(length=80), nullable=False, unique=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("description", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                onupdate=sa.func.now(),
                nullable=False,
            ),
        )
        op.create_index(op.f("ix_cash_categories_slug"), "cash_categories", ["slug"], unique=True)

    cash_txn_columns = {column["name"] for column in inspector.get_columns("cash_txns")}
    needs_category_id = "category_id" not in cash_txn_columns

    if needs_category_id:
        op.add_column(
            "cash_txns",
            sa.Column("category_id", sa.String(length=12), nullable=True),
        )
        op.create_index(op.f("ix_cash_txns_category_id"), "cash_txns", ["category_id"], unique=False)
        op.create_foreign_key(
            "fk_cash_txns_category_id",
            "cash_txns",
            "cash_categories",
            ["category_id"],
            ["id"],
            ondelete="RESTRICT",
        )

    cash_txns_table = sa.table(
        "cash_txns",
        sa.column("id", sa.String(length=12)),
        sa.column("category", sa.String(length=50)),
        sa.column("category_id", sa.String(length=12)),
    )
    categories_table = sa.table(
        "cash_categories",
        sa.column("id", sa.String(length=12)),
        sa.column("name", sa.String(length=80)),
        sa.column("slug", sa.String(length=80)),
        sa.column("is_active", sa.Boolean()),
        sa.column("is_system", sa.Boolean()),
        sa.column("description", sa.String(length=255)),
    )

    existing_categories: Dict[str, str] = {}
    prefix = "CAT"

    if needs_category_id and "category" in cash_txn_columns:
        distinct_categories = connection.execute(sa.text("SELECT DISTINCT category FROM cash_txns"))
        index = 1
        for row in distinct_categories:
            name = row[0] or "Diversos"
            slug = _slugify(name)
            while slug in existing_categories:
                slug = f"{slug}-{index}"
                index += 1
            category_id = f"{prefix}-{len(existing_categories) + 1:04d}"
            connection.execute(
                categories_table.insert().values(
                    id=category_id,
                    name=name,
                    slug=slug,
                    is_active=True,
                    is_system=True,
                    description=None,
                )
            )
            existing_categories[name] = category_id
            connection.execute(
                cash_txns_table.update()
                .where(cash_txns_table.c.category == row[0])
                .values(category_id=category_id)
            )

        missing = connection.execute(sa.text("SELECT COUNT(*) FROM cash_txns WHERE category_id IS NULL"))
        if missing.scalar() > 0:
            default_name = "Diversos"
            slug = _slugify(default_name)
            if default_name not in existing_categories:
                default_id = f"{prefix}-{len(existing_categories) + 1:04d}"
                connection.execute(
                    categories_table.insert().values(
                        id=default_id,
                        name=default_name,
                        slug=slug,
                        is_active=True,
                        is_system=True,
                        description=None,
                    )
                )
                existing_categories[default_name] = default_id
            connection.execute(
                cash_txns_table.update().where(cash_txns_table.c.category_id.is_(None)).values(
                    category_id=existing_categories[default_name]
                )
            )

        op.alter_column(
            "cash_txns",
            "category_id",
            nullable=False,
            existing_type=sa.String(length=12),
        )
        op.drop_column("cash_txns", "category")


def downgrade() -> None:
    op.add_column("cash_txns", sa.Column("category", sa.String(length=50), nullable=True))

    connection = op.get_bind()
    cash_txns_table = sa.table(
        "cash_txns",
        sa.column("category", sa.String(length=50)),
        sa.column("category_id", sa.String(length=12)),
    )
    categories_table = sa.table(
        "cash_categories",
        sa.column("id", sa.String(length=12)),
        sa.column("name", sa.String(length=80)),
    )
    join_stmt = (
        sa.select(cash_txns_table.c.category_id, categories_table.c.name)
        .select_from(
            cash_txns_table.join(categories_table, cash_txns_table.c.category_id == categories_table.c.id)
        )
    )
    result = connection.execute(join_stmt)
    for row in result:
        connection.execute(
            cash_txns_table.update()
            .where(cash_txns_table.c.category_id == row.category_id)
            .values(category=row.name)
        )

    op.drop_constraint("fk_cash_txns_category_id", "cash_txns", type_="foreignkey")
    op.drop_index(op.f("ix_cash_txns_category_id"), table_name="cash_txns")
    op.drop_column("cash_txns", "category_id")
    op.drop_index(op.f("ix_cash_categories_slug"), table_name="cash_categories")
    op.drop_table("cash_categories")
