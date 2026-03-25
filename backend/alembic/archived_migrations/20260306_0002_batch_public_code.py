"""Add unique 8-char public_code on batches for human / alternate scan id.

Revision ID: 20260306_0002
Revises: 20260321_0001
Create Date: 2026-03-06

"""
from typing import Sequence, Union

import secrets
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "20260306_0002"
down_revision: Union[str, None] = "20260321_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
_CODE_LEN = 8


def upgrade() -> None:
    op.add_column("batches", sa.Column("public_code", sa.String(length=10), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(text("SELECT id FROM batches")).fetchall()
    used: set[str] = set()
    for (bid,) in rows:
        for _ in range(500):
            code = "".join(secrets.choice(_ALPHABET) for _ in range(_CODE_LEN))
            if code not in used:
                used.add(code)
                break
        else:
            raise RuntimeError("Could not generate unique public_code for batch migration")
        connection.execute(
            text("UPDATE batches SET public_code = :c WHERE id = :id"),
            {"c": code, "id": bid},
        )

    op.create_index(op.f("ix_batches_public_code"), "batches", ["public_code"], unique=True)
    op.alter_column("batches", "public_code", existing_type=sa.String(length=10), nullable=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_batches_public_code"), table_name="batches")
    op.drop_column("batches", "public_code")
