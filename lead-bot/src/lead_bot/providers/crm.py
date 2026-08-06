from __future__ import annotations

import sqlite3
from pathlib import Path
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from lead_bot.config import get_settings
from lead_bot.services.suppression import add_suppression, is_suppressed
from lead_bot.providers.base import CrmBridge


class SqliteCrmBridge(CrmBridge):
    """Sync suppressions from the Next.js Prisma SQLite CRM and export approved leads."""

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    def _crm_path(self) -> Path | None:
        url = self.settings.crm_database_url
        if not url:
            # default relative to monorepo
            candidate = Path(__file__).resolve().parents[4] / "prisma" / "dev.db"
            return candidate if candidate.exists() else None
        if url.startswith("sqlite:///"):
            raw = url.replace("sqlite:///", "", 1)
            p = Path(raw)
            if not p.is_absolute():
                p = (Path(__file__).resolve().parents[2] / raw).resolve()
            return p if p.exists() else None
        return None

    def sync_suppressions(self) -> int:
        path = self._crm_path()
        if not path:
            return 0
        conn = sqlite3.connect(str(path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        added = 0
        try:
            # DO_NOT_CONTACT leads
            for row in cur.execute(
                "SELECT name, phone, email, website, status FROM Lead WHERE status = 'DO_NOT_CONTACT'"
            ):
                if self._add_if_new(
                    reason="do_not_contact",
                    telephone=row["phone"],
                    email=row["email"],
                    domain=_domain(row["website"]),
                    notes=f"CRM lead {row['name']}",
                ):
                    added += 1
            # Customers → existing_customer (expansion still allowed at scoring; blocks duplicate new leads)
            for row in cur.execute("SELECT name, phone, email, website FROM Customer"):
                if self._add_if_new(
                    reason="existing_customer",
                    telephone=row["phone"],
                    email=row["email"],
                    domain=_domain(row["website"]),
                    notes=f"CRM customer {row['name']}",
                    permanent=False,
                ):
                    added += 1
        except sqlite3.Error:
            conn.close()
            return added
        conn.close()
        self.db.commit()
        return added

    def _add_if_new(
        self,
        reason: str,
        *,
        telephone: str | None,
        email: str | None,
        domain: str | None,
        notes: str,
        permanent: bool = True,
    ) -> bool:
        if not any([telephone, email, domain]):
            return False
        if is_suppressed(
            self.db, telephone=telephone, email=email, domain=domain
        ):
            return False
        add_suppression(
            self.db,
            reason,
            telephone=telephone,
            email=email,
            domain=domain,
            source="crm",
            permanent=permanent,
            notes=notes,
        )
        return True

    def export_approved_lead(self, payload: dict) -> dict:
        url = self.settings.crm_export_url
        headers = {"x-mato-key": self.settings.lead_bot_api_key}
        try:
            with httpx.Client(timeout=20.0) as client:
                res = client.post(url, json=payload, headers=headers)
                res.raise_for_status()
                return res.json()
        except Exception as exc:
            return {"ok": False, "error": str(exc), "payload": payload}


def _domain(url: str | None) -> str | None:
    if not url:
        return None
    try:
        if "://" not in url:
            url = "https://" + url
        host = urlparse(url).hostname
        return host.lower() if host else None
    except Exception:
        return None
