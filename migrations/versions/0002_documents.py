"""add documents table"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_documents"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "entity_type",
            sa.Enum("vehicle", "driver", "rental", name="document_entity_type"),
            nullable=False,
        ),
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("stored_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_documents_entity", "documents", ["entity_type", "entity_id"], unique=False)
    op.create_index("ix_documents_stored_name", "documents", ["stored_name"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_documents_stored_name", table_name="documents")
    op.drop_index("ix_documents_entity", table_name="documents")
    op.drop_table("documents")
