"""Link cash transactions to expenses and capital."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0004_cash_links'
down_revision = '0003_vehicle_years'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('cash_txns', schema=None) as batch_op:
        batch_op.add_column(sa.Column('related_expense_id', sa.String(length=12), nullable=True))
        batch_op.add_column(sa.Column('related_capital_id', sa.String(length=12), nullable=True))
        batch_op.create_unique_constraint('uq_cash_expense_link', ['related_expense_id'])
        batch_op.create_unique_constraint('uq_cash_capital_link', ['related_capital_id'])
        batch_op.create_foreign_key(
            'fk_cash_expense_link', 'expenses', ['related_expense_id'], ['id'], ondelete='SET NULL'
        )
        batch_op.create_foreign_key(
            'fk_cash_capital_link', 'capital_entries', ['related_capital_id'], ['id'], ondelete='SET NULL'
        )


def downgrade() -> None:
    with op.batch_alter_table('cash_txns', schema=None) as batch_op:
        batch_op.drop_constraint('fk_cash_capital_link', type_='foreignkey')
        batch_op.drop_constraint('fk_cash_expense_link', type_='foreignkey')
        batch_op.drop_constraint('uq_cash_capital_link', type_='unique')
        batch_op.drop_constraint('uq_cash_expense_link', type_='unique')
        batch_op.drop_column('related_capital_id')
        batch_op.drop_column('related_expense_id')
