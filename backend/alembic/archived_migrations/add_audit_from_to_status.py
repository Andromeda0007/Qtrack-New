"""add audit from_status to_status

Revision ID: add_audit_status
Revises:
Create Date: 2025-03-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "add_audit_status"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("from_status", sa.String(50), nullable=True))
    op.add_column("audit_logs", sa.Column("to_status", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "to_status")
    op.drop_column("audit_logs", "from_status")
