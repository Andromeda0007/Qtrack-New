"""Add optional pack_size_description on batches (label / reporting).

Revision ID: 20260306_0003
Revises: 20260306_0002
Create Date: 2026-03-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260306_0003"
down_revision: Union[str, None] = "20260306_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "batches",
        sa.Column("pack_size_description", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("batches", "pack_size_description")
