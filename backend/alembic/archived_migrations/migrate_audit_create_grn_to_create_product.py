"""migrate audit CREATE_GRN to CREATE_PRODUCT

Revision ID: audit_grn_to_product
Revises: add_chat_desc
Create Date: 2025-03-06

Maps all existing audit_logs with action_type CREATE_GRN to CREATE_PRODUCT
so the product_creation filter (CREATE_PRODUCT only) shows them.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "audit_grn_to_product"
down_revision: Union[str, None] = "add_chat_desc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE audit_logs SET action_type = 'CREATE_PRODUCT' WHERE action_type = 'CREATE_GRN'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE audit_logs SET action_type = 'CREATE_GRN' WHERE action_type = 'CREATE_PRODUCT' AND entity_type = 'batch'"
    )
