"""learning operations

Revision ID: 20260804_learning
Revises: 79b0c52c188e
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260804_learning"
down_revision: Union[str, None] = "79b0c52c188e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rule_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.String(64), nullable=False, unique=True),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("config_checksum", sa.String(64), nullable=False, unique=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_by", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("promoted_by", sa.String(128)),
        sa.Column("promoted_at", sa.DateTime()),
    )
    op.create_table(
        "scorer_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rule_version_id", sa.Integer(), sa.ForeignKey("rule_versions.id"), nullable=False),
        sa.Column("establishment_id", sa.Integer(), sa.ForeignKey("establishments.id"), nullable=False),
        sa.Column("score_json", sa.JSON(), nullable=False),
        sa.Column("input_checksum", sa.String(64), nullable=False),
        sa.Column("authoritative", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "outcome_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_service", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(256), nullable=False),
        sa.Column("establishment_id", sa.Integer(), sa.ForeignKey("establishments.id"), nullable=False),
        sa.Column("intelligence_establishment_id", sa.String(64), nullable=False),
        sa.Column("enterprise_number", sa.String(32), nullable=False),
        sa.Column("establishment_number", sa.String(32), nullable=False),
        sa.Column("outcome_type", sa.String(32), nullable=False),
        sa.Column("outcome_value", sa.String(64), nullable=False),
        sa.Column("features_json", sa.JSON(), nullable=False),
        sa.Column("evidence_json", sa.JSON(), nullable=False),
        sa.Column("rule_score_json", sa.JSON(), nullable=False),
        sa.Column("machine_count", sa.Integer()),
        sa.Column("revenue_eur", sa.Float()),
        sa.Column("gross_margin_eur", sa.Float()),
        sa.Column("sales_cycle_days", sa.Float()),
        sa.Column("cohort", sa.String(64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source_service", "idempotency_key"),
    )
    op.create_table(
        "shadow_model_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("definition_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("minimum_samples", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "shadow_predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_version_id", sa.Integer(), sa.ForeignKey("shadow_model_versions.id"), nullable=False),
        sa.Column("outcome_snapshot_id", sa.Integer(), sa.ForeignKey("outcome_snapshots.id"), nullable=False),
        sa.Column("target", sa.String(32), nullable=False),
        sa.Column("prediction", sa.Float()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("reason", sa.String(256)),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("model_version_id", "outcome_snapshot_id", "target"),
    )
    op.create_table(
        "model_metrics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_version_id", sa.Integer(), sa.ForeignKey("shadow_model_versions.id"), nullable=False),
        sa.Column("cohort", sa.String(64), nullable=False),
        sa.Column("target", sa.String(32), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("metrics_json", sa.JSON(), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "provider_budgets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(64), nullable=False, unique=True),
        sa.Column("daily_limit_eur", sa.Float(), nullable=False),
        sa.Column("monthly_limit_eur", sa.Float(), nullable=False),
        sa.Column("cutoff_ratio", sa.Float(), nullable=False),
        sa.Column("alert_ratio", sa.Float(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "freshness_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("field_name", sa.String(128), nullable=False, unique=True),
        sa.Column("max_age_days", sa.Integer(), nullable=False),
        sa.Column("critical", sa.Boolean(), nullable=False),
        sa.Column("refresh_provider", sa.String(64)),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    for table in (
        "freshness_policies",
        "provider_budgets",
        "model_metrics",
        "shadow_predictions",
        "shadow_model_versions",
        "outcome_snapshots",
        "scorer_runs",
        "rule_versions",
    ):
        op.drop_table(table)
