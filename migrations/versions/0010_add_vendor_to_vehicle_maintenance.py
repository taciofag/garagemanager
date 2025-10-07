"""add vendor reference to maintenance"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0010_add_vendor_to_vehicle_maintenance"
down_revision = "0009_vehicle_maintenance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col['name'] for col in inspector.get_columns('vehicle_maintenance')}
    if 'vendor_id' not in columns:
        op.add_column(
            'vehicle_maintenance',
            sa.Column('vendor_id', sa.String(length=12), nullable=True)
        )
        op.create_foreign_key(
            'fk_vehicle_maintenance_vendor',
            'vehicle_maintenance',
            'vendors',
            ['vendor_id'],
            ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col['name'] for col in inspector.get_columns('vehicle_maintenance')}
    if 'vendor_id' in columns:
        op.drop_constraint('fk_vehicle_maintenance_vendor', 'vehicle_maintenance', type_='foreignkey')
        op.drop_column('vehicle_maintenance', 'vendor_id')
