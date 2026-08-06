from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class NbbProvider(ABC):
    @abstractmethod
    def financial_profile(self, enterprise_number: str) -> dict[str, Any]:
        ...


class UnavailableNbbProvider(NbbProvider):
    """Safe fallback: absence of licensed NBB data is explicit, never fabricated."""

    def financial_profile(self, enterprise_number: str) -> dict[str, Any]:
        return {
            "available": False,
            "enterprise_number": enterprise_number,
            "provider": "unavailable",
            "reason": "No licensed NBB provider configured",
            "confidence": 0.0,
        }


def get_nbb_provider() -> NbbProvider:
    return UnavailableNbbProvider()
