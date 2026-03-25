"""add chat_rooms description

Revision ID: add_chat_desc
Revises: add_audit_status
Create Date: 2025-03-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "add_chat_desc"
down_revision: Union[str, None] = "add_audit_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chat_rooms", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_rooms", "description")
