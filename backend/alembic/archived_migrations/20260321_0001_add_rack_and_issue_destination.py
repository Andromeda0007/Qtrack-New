"""Add rack_number on batches and issue destination on stock_movements.

Revision ID: 20260321_0001
Revises: audit_grn_to_product
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260321_0001"
down_revision: Union[str, None] = "audit_grn_to_product"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("batches", sa.Column("rack_number", sa.String(length=80), nullable=True))
    op.create_index(op.f("ix_batches_rack_number"), "batches", ["rack_number"], unique=False)
    op.add_column(
        "stock_movements",
        sa.Column("issued_to_product_name", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "stock_movements",
        sa.Column("issued_to_batch_ref", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stock_movements", "issued_to_batch_ref")
    op.drop_column("stock_movements", "issued_to_product_name")
    op.drop_index(op.f("ix_batches_rack_number"), table_name="batches")
    op.drop_column("batches", "rack_number")
