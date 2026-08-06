from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from lead_bot.db import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enterprise_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    official_name: Mapped[str] = mapped_column(String(512))
    legal_form: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="AC")
    start_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    language: Mapped[str | None] = mapped_column(String(8), nullable=True)
    is_natural_person: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    establishments: Mapped[list[Establishment]] = relationship(back_populates="organization")


class Establishment(Base):
    __tablename__ = "establishments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    establishment_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="AC")
    street: Mapped[str | None] = mapped_column(String(256), nullable=True)
    house_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    postcode: Mapped[str | None] = mapped_column(String(16), index=True)
    municipality: Mapped[str | None] = mapped_column(String(128), nullable=True)
    region: Mapped[str | None] = mapped_column(String(64), index=True)
    country: Mapped[str] = mapped_column(String(8), default="BE")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geocode_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    geo_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    start_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    preliminary_score: Mapped[float] = mapped_column(Float, default=0)
    segment_hint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    enrichment_stage: Mapped[str] = mapped_column(String(32), default="none")
    review_status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    organization: Mapped[Organization] = relationship(back_populates="establishments")
    activities: Mapped[list[Activity]] = relationship(back_populates="establishment")


class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (UniqueConstraint("establishment_id", "nace_code", "nace_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    nace_version: Mapped[str] = mapped_column(String(16), default="2008")
    nace_code: Mapped[str] = mapped_column(String(16), index=True)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    activity_type: Mapped[str] = mapped_column(String(32), default="MAIN")
    source_date: Mapped[str | None] = mapped_column(String(32), nullable=True)

    establishment: Mapped[Establishment] = relationship(back_populates="activities")


class SourceRecord(Base):
    __tablename__ = "source_records"
    __table_args__ = (
        UniqueConstraint("source_name", "source_identifier", "entity_type", "checksum"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String(64), index=True)
    source_identifier: Mapped[str] = mapped_column(String(128), index=True)
    entity_type: Mapped[str] = mapped_column(String(64))
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    source_updated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    checksum: Mapped[str] = mapped_column(String(64))
    import_audit_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_audits.id"), nullable=True, index=True
    )
    source_file: Mapped[str | None] = mapped_column(String(512), nullable=True)


class Suppression(Base):
    __tablename__ = "suppressions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enterprise_number: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    establishment_number: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    domain: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    telephone: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    reason: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(64), default="manual")
    requested_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    permanent: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Website(Base):
    __tablename__ = "websites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    establishment_id: Mapped[int | None] = mapped_column(
        ForeignKey("establishments.id"), nullable=True, index=True
    )
    domain: Mapped[str | None] = mapped_column(String(256), nullable=True)
    url: Mapped[str] = mapped_column(String(1024))
    source: Mapped[str] = mapped_column(String(64), default="manual")
    is_official: Mapped[bool] = mapped_column(Boolean, default=True)
    match_confidence: Mapped[float] = mapped_column(Float, default=1.0)
    last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    crawl_status: Mapped[str] = mapped_column(String(32), default="pending")
    discovered_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    establishment_id: Mapped[int | None] = mapped_column(
        ForeignKey("establishments.id"), nullable=True, index=True
    )
    feature_name: Mapped[str] = mapped_column(String(128), index=True)
    feature_value: Mapped[str] = mapped_column(Text)
    source_type: Mapped[str] = mapped_column(String(64))
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_date: Mapped[str | None] = mapped_column(String(64), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    source_reliability: Mapped[float] = mapped_column(Float, default=0.9)
    extraction_confidence: Mapped[float] = mapped_column(Float, default=0.8)
    entity_match_confidence: Mapped[float] = mapped_column(Float, default=1.0)
    freshness_factor: Mapped[float] = mapped_column(Float, default=1.0)


class Feature(Base):
    __tablename__ = "features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    establishment_id: Mapped[int | None] = mapped_column(
        ForeignKey("establishments.id"), nullable=True, index=True
    )
    feature_name: Mapped[str] = mapped_column(String(128), index=True)
    value_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    calculated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    model_version: Mapped[str] = mapped_column(String(64), default="v1")


class LeadScore(Base):
    __tablename__ = "lead_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    segment: Mapped[str] = mapped_column(String(64))
    quality_score: Mapped[float] = mapped_column(Float, default=0)
    confidence_score: Mapped[float] = mapped_column(Float, default=0)
    timing_score: Mapped[float] = mapped_column(Float, default=0)
    priority_score: Mapped[float] = mapped_column(Float, default=0)
    strategic_score: Mapped[float] = mapped_column(Float, default=0)
    expected_deal_value_eur: Mapped[float] = mapped_column(Float, default=0)
    expected_margin_eur: Mapped[float] = mapped_column(Float, default=0)
    tier: Mapped[str] = mapped_column(String(32), default="D")
    score_components_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    explainable_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    model_version: Mapped[str] = mapped_column(String(64))
    calculated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    human_feedback: Mapped[str | None] = mapped_column(String(64), nullable=True)

    recommendation: Mapped[MachineRecommendation | None] = relationship(
        back_populates="lead_score", uselist=False
    )


class MachineRecommendation(Base):
    __tablename__ = "machine_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_score_id: Mapped[int] = mapped_column(ForeignKey("lead_scores.id"), unique=True)
    primary_machine: Mapped[str] = mapped_column(String(64))
    alternative_machines_json: Mapped[list[Any]] = mapped_column(JSON, default=list)
    required_features_json: Mapped[list[Any]] = mapped_column(JSON, default=list)
    reasons_json: Mapped[list[Any]] = mapped_column(JSON, default=list)
    questions_json: Mapped[list[Any]] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)

    lead_score: Mapped[LeadScore] = relationship(back_populates="recommendation")


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    establishment_id: Mapped[int | None] = mapped_column(ForeignKey("establishments.id"), nullable=True)
    contact_type: Mapped[str] = mapped_column(String(32))
    contact_value: Mapped[str] = mapped_column(String(512))
    generic_business_contact: Mapped[bool] = mapped_column(Boolean, default=True)
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verification_state: Mapped[str] = mapped_column(String(32), default="unverified", index=True)
    verification_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    lawful_basis: Mapped[str] = mapped_column(String(64), default="legitimate_interest")
    policy_version: Mapped[str] = mapped_column(String(64), default="2026-01")
    status: Mapped[str] = mapped_column(String(32), default="active")


class CostEvent(Base):
    __tablename__ = "cost_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    establishment_id: Mapped[int | None] = mapped_column(ForeignKey("establishments.id"), nullable=True)
    provider: Mapped[str] = mapped_column(String(64))
    operation: Mapped[str] = mapped_column(String(64))
    units: Mapped[float] = mapped_column(Float, default=1)
    estimated_cost_eur: Mapped[float] = mapped_column(Float, default=0)
    meta_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    data_fresh_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    queue: Mapped[str] = mapped_column(String(64), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(256), unique=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)


class ReviewAction(Base):
    __tablename__ = "review_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    action: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    actor: Mapped[str] = mapped_column(String(128), default="reviewer")
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lawful_basis: Mapped[str] = mapped_column(String(64), default="legitimate_interest")
    policy_version: Mapped[str] = mapped_column(String(64), default="2026-01")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ImportAudit(Base):
    __tablename__ = "import_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String(64), default="kbo")
    source_path: Mapped[str] = mapped_column(String(1024))
    source_checksum: Mapped[str] = mapped_column(String(64), index=True)
    import_type: Mapped[str] = mapped_column(String(16))
    source_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="running", index=True)
    stats_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Denomination(Base):
    __tablename__ = "denominations"
    __table_args__ = (
        UniqueConstraint("entity_number", "language", "denomination_type", "value"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_number: Mapped[str] = mapped_column(String(32), index=True)
    language: Mapped[str] = mapped_column(String(8), default="")
    denomination_type: Mapped[str] = mapped_column(String(32), default="")
    value: Mapped[str] = mapped_column(String(512))


class KboAddress(Base):
    __tablename__ = "kbo_addresses"
    __table_args__ = (UniqueConstraint("entity_number", "address_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_number: Mapped[str] = mapped_column(String(32), index=True)
    address_type: Mapped[str] = mapped_column(String(32), default="REGO")
    street: Mapped[str | None] = mapped_column(String(256), nullable=True)
    house_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    box: Mapped[str | None] = mapped_column(String(32), nullable=True)
    postcode: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    municipality: Mapped[str | None] = mapped_column(String(128), nullable=True)
    country: Mapped[str] = mapped_column(String(8), default="BE")


class CodeReference(Base):
    __tablename__ = "code_references"
    __table_args__ = (UniqueConstraint("category", "code", "language"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String(64), index=True)
    code: Mapped[str] = mapped_column(String(64), index=True)
    language: Mapped[str] = mapped_column(String(8), default="")
    description: Mapped[str] = mapped_column(String(1024), default="")


class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("branch_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_number: Mapped[str] = mapped_column(String(32), index=True)
    enterprise_number: Mapped[str] = mapped_column(String(32), index=True)
    start_date: Mapped[str | None] = mapped_column(String(32), nullable=True)


class MatchCandidate(Base):
    __tablename__ = "match_candidates"
    __table_args__ = (
        UniqueConstraint("source_type", "source_identifier", "target_type", "target_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_type: Mapped[str] = mapped_column(String(64), index=True)
    source_identifier: Mapped[str] = mapped_column(String(256), index=True)
    target_type: Mapped[str] = mapped_column(String(64))
    target_id: Mapped[int] = mapped_column(Integer, index=True)
    match_method: Mapped[str] = mapped_column(String(64))
    score: Mapped[float] = mapped_column(Float)
    decision: Mapped[str] = mapped_column(String(32), index=True)
    evidence_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class EntityLink(Base):
    __tablename__ = "entity_links"
    __table_args__ = (
        UniqueConstraint("source_type", "source_identifier", "target_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_type: Mapped[str] = mapped_column(String(64), index=True)
    source_identifier: Mapped[str] = mapped_column(String(256), index=True)
    target_type: Mapped[str] = mapped_column(String(64))
    target_id: Mapped[int] = mapped_column(Integer, index=True)
    match_candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("match_candidates.id"), nullable=True
    )
    confidence: Mapped[float] = mapped_column(Float)
    linked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FeedbackEvent(Base):
    __tablename__ = "feedback_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    actor: Mapped[str] = mapped_column(String(128))
    lawful_basis: Mapped[str] = mapped_column(String(64))
    policy_version: Mapped[str] = mapped_column(String(64))
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    actor: Mapped[str] = mapped_column(String(128))
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RuleVersion(Base):
    """Immutable scoring configuration; promotion is always an explicit transition."""

    __tablename__ = "rule_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    config_checksum: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(32), default="candidate", index=True)
    created_by: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    promoted_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ScorerRun(Base):
    __tablename__ = "scorer_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rule_version_id: Mapped[int] = mapped_column(ForeignKey("rule_versions.id"), index=True)
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    score_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    input_checksum: Mapped[str] = mapped_column(String(64))
    authoritative: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class OutcomeSnapshot(Base):
    """Append-only learning record containing the evidence exactly as scored."""

    __tablename__ = "outcome_snapshots"
    __table_args__ = (
        UniqueConstraint("source_service", "idempotency_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_service: Mapped[str] = mapped_column(String(64), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(256))
    establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    intelligence_establishment_id: Mapped[str] = mapped_column(String(64), index=True)
    enterprise_number: Mapped[str] = mapped_column(String(32), index=True)
    establishment_number: Mapped[str] = mapped_column(String(32), index=True)
    outcome_type: Mapped[str] = mapped_column(String(32), index=True)
    outcome_value: Mapped[str] = mapped_column(String(64))
    features_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    evidence_json: Mapped[list[Any]] = mapped_column(JSON)
    rule_score_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    machine_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    revenue_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    gross_margin_eur: Mapped[float | None] = mapped_column(Float, nullable=True)
    sales_cycle_days: Mapped[float | None] = mapped_column(Float, nullable=True)
    cohort: Mapped[str] = mapped_column(String(64), default="all", index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ShadowModelVersion(Base):
    __tablename__ = "shadow_model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[str] = mapped_column(String(64))
    definition_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="shadow")
    minimum_samples: Mapped[int] = mapped_column(Integer, default=20)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ShadowPrediction(Base):
    __tablename__ = "shadow_predictions"
    __table_args__ = (
        UniqueConstraint("model_version_id", "outcome_snapshot_id", "target"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_version_id: Mapped[int] = mapped_column(ForeignKey("shadow_model_versions.id"), index=True)
    outcome_snapshot_id: Mapped[int] = mapped_column(ForeignKey("outcome_snapshots.id"), index=True)
    target: Mapped[str] = mapped_column(String(32), index=True)
    prediction: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="ok")
    reason: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ModelMetric(Base):
    __tablename__ = "model_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_version_id: Mapped[int] = mapped_column(ForeignKey("shadow_model_versions.id"), index=True)
    cohort: Mapped[str] = mapped_column(String(64), index=True)
    target: Mapped[str] = mapped_column(String(32), index=True)
    sample_count: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32))
    metrics_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ProviderBudget(Base):
    __tablename__ = "provider_budgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    daily_limit_eur: Mapped[float] = mapped_column(Float)
    monthly_limit_eur: Mapped[float] = mapped_column(Float)
    cutoff_ratio: Mapped[float] = mapped_column(Float, default=1.0)
    alert_ratio: Mapped[float] = mapped_column(Float, default=0.8)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class FreshnessPolicy(Base):
    __tablename__ = "freshness_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    max_age_days: Mapped[int] = mapped_column(Integer)
    critical: Mapped[bool] = mapped_column(Boolean, default=False)
    refresh_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
