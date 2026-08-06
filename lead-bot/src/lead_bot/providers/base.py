from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class CompanyRegistryProvider(ABC):
    @abstractmethod
    def import_archive(self, path: str, territory: str) -> dict[str, int]:
        ...


class PlacesProvider(ABC):
    """POI enrichment — OpenStreetMap by default; Google Places if keyed."""

    @abstractmethod
    def match_establishment(self, name: str, address: str) -> dict[str, Any] | None:
        ...

    def search_category(
        self, query: str, region_bias: str = "Vlaanderen", page_size: int = 10
    ) -> list[dict[str, Any]]:
        return []

    @property
    def available(self) -> bool:
        return True

    @property
    def provider_name(self) -> str:
        return "places"


class WebsiteCrawler(ABC):
    @abstractmethod
    def crawl(self, start_url: str) -> list[dict[str, Any]]:
        ...


class LLMExtractor(ABC):
    @abstractmethod
    def extract(self, pages: list[dict[str, Any]], company_name: str) -> dict[str, Any]:
        ...


class GeographicContextProvider(ABC):
    @abstractmethod
    def distance_km(self, lat: float, lng: float) -> float:
        ...


class LeadScoringEngine(ABC):
    @abstractmethod
    def score(self, context: dict[str, Any]) -> dict[str, Any]:
        ...


class CrmBridge(ABC):
    @abstractmethod
    def sync_suppressions(self) -> int:
        ...

    @abstractmethod
    def export_approved_lead(self, payload: dict[str, Any]) -> dict[str, Any]:
        ...
