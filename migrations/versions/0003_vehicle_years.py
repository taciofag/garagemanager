from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003_vehicle_years'
down_revision = '0002_documents'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('vehicles') as batch_op:
        batch_op.add_column(sa.Column('manufacture_year', sa.Integer(), nullable=True))
    op.execute("UPDATE vehicles SET manufacture_year = year WHERE manufacture_year IS NULL")
    with op.batch_alter_table('vehicles') as batch_op:
        batch_op.alter_column('manufacture_year', existing_type=sa.Integer(), nullable=False)
        batch_op.create_check_constraint('ck_vehicle_manufacture_year_valid', 'manufacture_year >= 1900')
        batch_op.create_check_constraint('ck_vehicle_model_year_valid', 'year >= manufacture_year')


def downgrade() -> None:
    with op.batch_alter_table('vehicles') as batch_op:
        batch_op.drop_constraint('ck_vehicle_model_year_valid', type_='check')
        batch_op.drop_constraint('ck_vehicle_manufacture_year_valid', type_='check')
        batch_op.drop_column('manufacture_year')
