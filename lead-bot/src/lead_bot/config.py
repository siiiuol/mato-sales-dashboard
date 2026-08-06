from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"

load_dotenv(ROOT / ".env")


def _resolve_database_url(raw: str) -> str:
    if raw in {"sqlite:///:memory:", "sqlite+pysqlite:///:memory:"}:
        return raw
    if raw.startswith("sqlite:///"):
        path_part = raw.replace("sqlite:///", "", 1)
        # absolute windows path like C:/...
        if len(path_part) >= 2 and path_part[1] == ":":
            Path(path_part).parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{Path(path_part).as_posix()}"
        p = (ROOT / path_part).resolve() if not path_part.startswith("/") else Path(path_part)
        # handle ./data/...
        if path_part.startswith("./"):
            p = (ROOT / path_part[2:]).resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{p.as_posix()}"
    return raw


class Settings:
    def __init__(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        default_db = f"sqlite:///{(DATA_DIR / 'mato_leads.db').as_posix()}"
        self.database_url = _resolve_database_url(os.getenv("DATABASE_URL", default_db))
        self.redis_url = os.getenv("REDIS_URL", "")
        self.celery_broker_url = os.getenv("CELERY_BROKER_URL", "")
        self.celery_result_backend = os.getenv("CELERY_RESULT_BACKEND", "")
        self.celery_task_always_eager = (
            os.getenv("CELERY_TASK_ALWAYS_EAGER", "true").lower() == "true"
        )
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.openai_base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.environment = os.getenv("APP_ENV", "development").lower()
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        self.lead_bot_api_key = os.getenv("LEAD_BOT_API_KEY", "")
        if self.environment == "production" and (
            not self.lead_bot_api_key or self.lead_bot_api_key == "mato-dev-key"
        ):
            raise RuntimeError("A non-default LEAD_BOT_API_KEY is required in production")
        if not self.lead_bot_api_key:
            self.lead_bot_api_key = "mato-dev-key"
        self.learning_service_key = os.getenv("LEARNING_SERVICE_KEY", self.lead_bot_api_key)
        if self.environment == "production" and (
            not self.learning_service_key or self.learning_service_key == "mato-dev-key"
        ):
            raise RuntimeError("A non-default LEARNING_SERVICE_KEY is required in production")
        self.cors_origins = [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
            ).split(",")
            if origin.strip()
        ]
        if "*" in self.cors_origins:
            raise RuntimeError("Wildcard CORS origins are not allowed")
        self.ingestion_root = Path(
            os.getenv("KBO_INGESTION_ROOT", str(DATA_DIR / "kbo"))
        ).resolve()
        self.ingestion_root.mkdir(parents=True, exist_ok=True)
        self.nace_versions = {
            item.strip() for item in os.getenv("NACE_VERSIONS", "2003,2008,2025").split(",")
            if item.strip()
        }
        self.entity_auto_match_threshold = float(
            os.getenv("ENTITY_AUTO_MATCH_THRESHOLD", "0.90")
        )
        self.entity_review_threshold = float(
            os.getenv("ENTITY_REVIEW_THRESHOLD", "0.75")
        )
        self.google_places_api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
        self.google_places_cost_eur = float(os.getenv("GOOGLE_PLACES_COST_EUR", "0.032"))
        self.nbb_provider = os.getenv("NBB_PROVIDER", "unavailable")
        self.lawful_basis = os.getenv("LAWFUL_BASIS", "legitimate_interest")
        self.policy_version = os.getenv("POLICY_VERSION", "2026-01")
        self.correlation_header = os.getenv("CORRELATION_HEADER", "x-correlation-id")
        self.crm_database_url = os.getenv("CRM_DATABASE_URL", "")
        self.crm_export_url = os.getenv(
            "CRM_EXPORT_URL", "http://localhost:3000/api/intelligence/import"
        )
        self.territory = os.getenv("TERRITORY", "east_west_flanders")
        self.mato_lat = float(os.getenv("MATO_LAT", "51.05"))
        self.mato_lng = float(os.getenv("MATO_LNG", "3.72"))
        self.crawl_max_pages = int(os.getenv("CRAWL_MAX_PAGES", "20"))
        self.crawl_max_rps = float(os.getenv("CRAWL_MAX_RPS", "2.0"))
        self.crawl_max_bytes = int(os.getenv("CRAWL_MAX_BYTES", str(10 * 1024 * 1024)))
        self.prompt_version = os.getenv("PROMPT_VERSION", "extract-v1")
        self.model_version = os.getenv("MODEL_VERSION", "rules-score-v1")
        self.scorer_version = os.getenv("SCORER_VERSION", "score-v1")

    def validate_import_path(self, raw_path: str) -> Path:
        candidate = Path(raw_path)
        if not candidate.is_absolute():
            candidate = self.ingestion_root / candidate
        resolved = candidate.resolve()
        if resolved != self.ingestion_root and self.ingestion_root not in resolved.parents:
            raise ValueError("Import path must be inside KBO_INGESTION_ROOT")
        if not resolved.exists():
            raise ValueError("Import path does not exist")
        return resolved


@lru_cache
def get_settings() -> Settings:
    return Settings()
