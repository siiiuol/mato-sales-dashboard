"""expected margin ranking

Revision ID: 20260804_ev_margin
Revises: 20260804_learning
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260804_ev_margin"
down_revision: Union[str, None] = "20260804_learning"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lead_scores",
        sa.Column("expected_margin_eur", sa.Float(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("lead_scores", "expected_margin_eur")
