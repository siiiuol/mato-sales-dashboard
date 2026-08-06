from __future__ import annotations

import csv
import hashlib
import io
import json
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from sqlalchemy.orm import Session

from lead_bot.config import get_settings
from lead_bot.models import (
    Activity,
    Branch,
    CodeReference,
    Contact,
    Denomination,
    Establishment,
    ImportAudit,
    KboAddress,
    Organization,
    SourceRecord,
)
from lead_bot.providers.base import CompanyRegistryProvider
from lead_bot.services.config_loader import (
    load_nace_segments,
    load_territory,
    postcode_in_territory,
    region_from_postcode,
)
from lead_bot.services.preliminary import compute_preliminary

TABLES = (
    "meta",
    "enterprise",
    "establishment",
    "denomination",
    "address",
    "contact",
    "activity",
    "code",
    "branch",
)


def _checksum(payload: object) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _pick(row: dict, keys: Iterable[str]) -> str | None:
    lower = {str(k).lower(): v for k, v in row.items()}
    for key in keys:
        value = row.get(key, lower.get(key.lower()))
        if value not in (None, ""):
            return str(value).strip()
    return None


def _norm_number(value: str | None) -> str:
    return "".join(c for c in (value or "") if c.isdigit())


def _read_csv(data: bytes) -> list[dict]:
    text = data.decode("utf-8-sig", errors="replace")
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;|\t")
    except csv.Error:
        dialect = csv.excel
    return [dict(row) for row in csv.DictReader(io.StringIO(text), dialect=dialect)]


def _classify_file(name: str) -> tuple[str | None, str]:
    stem = Path(name).stem.lower()
    operation = "delete" if any(x in stem for x in ("delete", "deletions", "remove")) else "upsert"
    for table in TABLES:
        if table in stem:
            return table, operation
    return None, operation


class KboZipProvider(CompanyRegistryProvider):
    """Transactional importer for official CBE/KBO full and daily archives.

    Official tables and simplified sample fixtures share the same normalization
    path. Daily archives apply delete records before inserts/upserts.
    """

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    def import_archive(
        self, path: str, territory: str, import_type: str | None = None
    ) -> dict[str, int | str]:
        source = self.settings.validate_import_path(path)
        files = self._load(source)
        metadata = self._metadata(files.get(("meta", "upsert"), []))
        kind = (import_type or metadata.get("snapshot_type") or self._infer_type(source)).lower()
        if kind not in {"full", "daily", "update"}:
            raise ValueError("import_type must be full, daily, or update")
        kind = "daily" if kind == "update" else kind
        digest = self._source_digest(source)
        prior = (
            self.db.query(ImportAudit)
            .filter_by(source_checksum=digest, status="completed")
            .one_or_none()
        )
        if prior:
            result = dict(prior.stats_json or {})
            result.update({"status": "already_imported", "audit_id": prior.id})
            return result

        audit = ImportAudit(
            source_path=str(source),
            source_checksum=digest,
            import_type=kind,
            source_date=metadata.get("snapshot_date"),
            metadata_json=metadata,
        )
        self.db.add(audit)
        self.db.flush()
        stats: dict[str, int | str] = {table: 0 for table in TABLES if table != "meta"}
        stats.update({"deleted": 0, "skipped": 0, "status": "completed"})
        try:
            territory_cfg = load_territory(territory)
            self._apply_deletes(files, stats)
            self._ingest(files, territory_cfg, audit.id, stats, kind)
            audit.status = "completed"
            audit.stats_json = stats
            audit.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
            self.db.commit()
            stats["audit_id"] = audit.id
            return stats
        except Exception as exc:
            self.db.rollback()
            failure = ImportAudit(
                source_path=str(source),
                source_checksum=digest,
                import_type=kind,
                source_date=metadata.get("snapshot_date"),
                status="failed",
                metadata_json={**metadata, "error": str(exc)[:2000]},
                finished_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
            self.db.add(failure)
            self.db.commit()
            raise

    def _load(self, source: Path) -> dict[tuple[str, str], list[dict]]:
        result: dict[tuple[str, str], list[dict]] = defaultdict(list)
        if source.is_dir():
            entries = [(p.name, p.read_bytes()) for p in source.glob("*.csv")]
        elif source.suffix.lower() == ".zip":
            with zipfile.ZipFile(source) as archive:
                entries = [
                    (name, archive.read(name))
                    for name in archive.namelist()
                    if name.lower().endswith(".csv")
                ]
        else:
            raise ValueError("KBO source must be a ZIP archive or CSV directory")
        for name, data in entries:
            table, operation = _classify_file(name)
            if table:
                result[(table, operation)].extend(_read_csv(data))
        has_entities = any(
            result.get((table, operation))
            for table in ("enterprise", "establishment")
            for operation in ("upsert", "delete")
        )
        if not has_entities:
            raise ValueError("Archive has no enterprise or establishment records")
        return result

    def _metadata(self, rows: list[dict]) -> dict[str, str]:
        result: dict[str, str] = {}
        for row in rows:
            key = _pick(row, ["Key", "Variable", "Name", "Metadata"])
            value = _pick(row, ["Value", "Waarde", "Valeur", "Description"])
            if key and value:
                result[key.strip().lower().replace(" ", "_")] = value
            for candidate in ("SnapshotDate", "Date", "FileDate"):
                if _pick(row, [candidate]):
                    result["snapshot_date"] = _pick(row, [candidate]) or ""
            for candidate in ("SnapshotType", "Type", "FileType"):
                if _pick(row, [candidate]):
                    result["snapshot_type"] = (_pick(row, [candidate]) or "").lower()
        return result

    def _infer_type(self, source: Path) -> str:
        return "daily" if any(x in source.name.lower() for x in ("update", "daily")) else "full"

    def _source_digest(self, source: Path) -> str:
        digest = hashlib.sha256()
        if source.is_file():
            with source.open("rb") as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(chunk)
        else:
            for child in sorted(source.glob("*.csv"), key=lambda item: item.name.lower()):
                digest.update(child.name.encode())
                digest.update(child.read_bytes())
        return digest.hexdigest()

    def _apply_deletes(self, files, stats: dict) -> None:
        model_map = {
            "enterprise": (Organization, "enterprise_number", ["EnterpriseNumber", "EntityNumber"]),
            "establishment": (
                Establishment,
                "establishment_number",
                ["EstablishmentNumber", "EntityNumber"],
            ),
            "denomination": (Denomination, "entity_number", ["EntityNumber"]),
            "address": (KboAddress, "entity_number", ["EntityNumber"]),
            "branch": (Branch, "branch_number", ["BranchNumber", "EntityNumber"]),
        }
        for table, (model, column, keys) in model_map.items():
            for row in files.get((table, "delete"), []):
                number = _norm_number(_pick(row, keys))
                if number:
                    stats["deleted"] += self.db.query(model).filter(
                        getattr(model, column) == number
                    ).delete(synchronize_session=False)
        for row in files.get(("activity", "delete"), []):
            entity = _norm_number(_pick(row, ["EntityNumber", "EstablishmentNumber"]))
            code = _pick(row, ["NaceCode", "ActivityCode", "Code"])
            est = self.db.query(Establishment).filter_by(establishment_number=entity).first()
            if est:
                query = self.db.query(Activity).filter_by(establishment_id=est.id)
                if code:
                    query = query.filter_by(nace_code=code)
                stats["deleted"] += query.delete(synchronize_session=False)
        for row in files.get(("contact", "delete"), []):
            entity = _norm_number(_pick(row, ["EntityNumber", "EnterpriseNumber"]))
            value = _pick(row, ["Value", "Contact", "ContactValue"])
            query = self.db.query(Contact)
            if entity:
                org = self.db.query(Organization).filter_by(enterprise_number=entity).first()
                est = self.db.query(Establishment).filter_by(establishment_number=entity).first()
                if org:
                    query = query.filter_by(organization_id=org.id)
                elif est:
                    query = query.filter_by(establishment_id=est.id)
                else:
                    continue
            if value:
                query = query.filter_by(contact_value=value)
            stats["deleted"] += query.delete(synchronize_session=False)

    def _ingest(self, files, territory_cfg: dict, audit_id: int, stats: dict, kind: str) -> None:
        denominations = self._denomination_map(files.get(("denomination", "upsert"), []))
        addresses = self._address_map(files.get(("address", "upsert"), []))
        seen_enterprises: set[str] = set()
        seen_establishments: set[str] = set()

        for row in files.get(("enterprise", "upsert"), []):
            number = _norm_number(
                _pick(row, ["EnterpriseNumber", "EntityNumber", "Ondernemingsnummer"])
            )
            if not number:
                continue
            self._upsert_org(number, row, denominations.get(number), audit_id)
            seen_enterprises.add(number)
            stats["enterprise"] += 1

        for row in files.get(("establishment", "upsert"), []):
            est_number = _norm_number(
                _pick(row, ["EstablishmentNumber", "EntityNumber", "Vestigingseenheidsnummer"])
            )
            ent_number = _norm_number(
                _pick(row, ["EnterpriseNumber", "Enterprise", "Ondernemingsnummer"])
            )
            if not est_number or not ent_number:
                stats["skipped"] += 1
                continue
            address = addresses.get(est_number, {})
            postcode = _pick(row, ["Zipcode", "PostalCode", "PostCode"]) or address.get("postcode")
            if not postcode_in_territory(postcode, territory_cfg):
                stats["skipped"] += 1
                continue
            org = self.db.query(Organization).filter_by(enterprise_number=ent_number).one_or_none()
            if not org:
                org = self._upsert_org(ent_number, {}, denominations.get(ent_number), audit_id)
            status = (_pick(row, ["Status"]) or "AC").upper()
            values = {
                "organization_id": org.id,
                "name": _pick(row, ["Denomination", "Name"])
                or denominations.get(est_number)
                or org.official_name,
                "status": "AC" if status in {"AC", "ACTIVE", "ACTIEF", ""} else status,
                "street": _pick(row, ["StreetNL", "StreetFR", "Street"]) or address.get("street"),
                "house_number": _pick(row, ["HouseNumber"]) or address.get("house_number"),
                "postcode": postcode,
                "municipality": _pick(row, ["MunicipalityNL", "MunicipalityFR", "Municipality", "City"])
                or address.get("municipality"),
                "region": region_from_postcode(postcode),
                "country": address.get("country", "BE"),
                "start_date": _pick(row, ["StartDate"]),
            }
            est = self.db.query(Establishment).filter_by(
                establishment_number=est_number
            ).one_or_none()
            if est:
                for key, value in values.items():
                    setattr(est, key, value)
            else:
                est = Establishment(establishment_number=est_number, **values)
                self.db.add(est)
            self.db.flush()
            self._source("establishment", est_number, row, audit_id)
            seen_establishments.add(est_number)
            stats["establishment"] += 1

        self._upsert_denominations(files.get(("denomination", "upsert"), []), stats)
        self._upsert_addresses(files.get(("address", "upsert"), []), stats)
        self._upsert_contacts(files.get(("contact", "upsert"), []), stats)
        self._upsert_activities(files.get(("activity", "upsert"), []), stats)
        self._upsert_codes(files.get(("code", "upsert"), []), stats)
        self._upsert_branches(files.get(("branch", "upsert"), []), stats)

        if kind == "full":
            # A full snapshot is authoritative for active status without deleting
            # local enrichment, reviews, scores, or compliance records.
            if seen_enterprises:
                self.db.query(Organization).filter(
                    ~Organization.enterprise_number.in_(seen_enterprises)
                ).update({"status": "INACTIVE"}, synchronize_session=False)
            if seen_establishments:
                self.db.query(Establishment).filter(
                    ~Establishment.establishment_number.in_(seen_establishments)
                ).update({"status": "INACTIVE"}, synchronize_session=False)

        nace_cfg = load_nace_segments()
        for est in self.db.query(Establishment).filter_by(status="AC").all():
            score, hint = compute_preliminary(est, [a.nace_code for a in est.activities], nace_cfg)
            est.preliminary_score, est.segment_hint = score, hint

    def _upsert_org(self, number: str, row: dict, denomination: str | None, audit_id: int):
        org = self.db.query(Organization).filter_by(enterprise_number=number).one_or_none()
        entity_type = _pick(row, ["TypeOfEnterprise", "EntityType"]) or ""
        values = {
            "official_name": denomination
            or _pick(row, ["Denomination", "Name", "OfficialName"])
            or (org.official_name if org else f"Enterprise {number}"),
            "legal_form": _pick(row, ["JuridicalForm", "LegalForm"]),
            "entity_type": entity_type,
            "status": (_pick(row, ["Status"]) or "AC").upper(),
            "start_date": _pick(row, ["StartDate"]),
            "is_natural_person": entity_type.upper() in {"1", "NP", "NATURAL"}
            or "persoon" in entity_type.lower(),
        }
        if org:
            for key, value in values.items():
                if value is not None:
                    setattr(org, key, value)
        else:
            org = Organization(enterprise_number=number, **values)
            self.db.add(org)
        self.db.flush()
        self._source("organization", number, row, audit_id)
        return org

    def _denomination_map(self, rows: list[dict]) -> dict[str, str]:
        result = {}
        for row in rows:
            number = _norm_number(_pick(row, ["EntityNumber", "EnterpriseNumber"]))
            value = _pick(row, ["Denomination", "Value", "Name"])
            if number and value and number not in result:
                result[number] = value
        return result

    def _address_map(self, rows: list[dict]) -> dict[str, dict]:
        result = {}
        for row in rows:
            number = _norm_number(_pick(row, ["EntityNumber", "EstablishmentNumber"]))
            if number:
                result[number] = {
                    "street": _pick(row, ["StreetNL", "StreetFR", "Street"]),
                    "house_number": _pick(row, ["HouseNumber"]),
                    "postcode": _pick(row, ["Zipcode", "PostalCode"]),
                    "municipality": _pick(
                        row, ["MunicipalityNL", "MunicipalityFR", "Municipality"]
                    ),
                    "country": _pick(row, ["CountryNL", "CountryCode"]) or "BE",
                }
        return result

    def _upsert_denominations(self, rows: list[dict], stats: dict) -> None:
        for row in rows:
            number = _norm_number(_pick(row, ["EntityNumber", "EnterpriseNumber"]))
            value = _pick(row, ["Denomination", "Value", "Name"])
            if not number or not value:
                continue
            keys = {
                "entity_number": number,
                "language": _pick(row, ["Language"]) or "",
                "denomination_type": _pick(row, ["TypeOfDenomination", "Type"]) or "",
                "value": value,
            }
            if not self.db.query(Denomination).filter_by(**keys).first():
                self.db.add(Denomination(**keys))
            stats["denomination"] += 1

    def _upsert_addresses(self, rows: list[dict], stats: dict) -> None:
        for row in rows:
            number = _norm_number(_pick(row, ["EntityNumber", "EstablishmentNumber"]))
            if not number:
                continue
            kind = _pick(row, ["TypeOfAddress", "AddressType"]) or "REGO"
            obj = self.db.query(KboAddress).filter_by(
                entity_number=number, address_type=kind
            ).one_or_none()
            values = self._address_map([row])[number]
            if obj:
                for key, value in values.items():
                    setattr(obj, key, value)
            else:
                self.db.add(KboAddress(entity_number=number, address_type=kind, **values))
            stats["address"] += 1

    def _upsert_contacts(self, rows: list[dict], stats: dict) -> None:
        for row in rows:
            entity = _norm_number(_pick(row, ["EntityNumber", "EnterpriseNumber"]))
            value = _pick(row, ["Value", "Contact", "ContactValue"])
            kind = (_pick(row, ["ContactType", "TypeOfContact", "Type"]) or "").lower()
            if not entity or not value:
                continue
            est = self.db.query(Establishment).filter_by(establishment_number=entity).first()
            org = (
                est.organization
                if est
                else self.db.query(Organization).filter_by(enterprise_number=entity).first()
            )
            if not org:
                continue
            if kind in {"web", "website", "url"} or value.lower().startswith(("http://", "https://")):
                kind = "website"
            elif "mail" in kind or "@" in value:
                kind = "email"
                value = value.lower()
            else:
                kind = "phone"
            exists = self.db.query(Contact).filter_by(
                organization_id=org.id, establishment_id=est.id if est else None,
                contact_type=kind, contact_value=value
            ).first()
            if not exists:
                self.db.add(
                    Contact(
                        organization_id=org.id,
                        establishment_id=est.id if est else None,
                        contact_type=kind,
                        contact_value=value,
                        source_url="kbo",
                        verification_state="source_verified",
                        verification_provider="kbo",
                        lawful_basis=self.settings.lawful_basis,
                        policy_version=self.settings.policy_version,
                    )
                )
            stats["contact"] += 1

    def _upsert_activities(self, rows: list[dict], stats: dict) -> None:
        for row in rows:
            entity = _norm_number(_pick(row, ["EntityNumber", "EstablishmentNumber"]))
            code = _pick(row, ["NaceCode", "ActivityCode", "Code"])
            version = _pick(row, ["NaceVersion", "Version"])
            classification = _pick(row, ["Classification"])
            if not version and classification in self.settings.nace_versions:
                version = classification
            version = version or "2008"
            if not entity or not code or version not in self.settings.nace_versions:
                continue
            targets = self.db.query(Establishment).filter_by(establishment_number=entity).all()
            if not targets:
                org = self.db.query(Organization).filter_by(enterprise_number=entity).first()
                targets = org.establishments if org else []
            for est in targets:
                keys = {
                    "establishment_id": est.id,
                    "nace_code": code,
                    "nace_version": version,
                }
                activity = self.db.query(Activity).filter_by(**keys).one_or_none()
                values = {
                    "description": _pick(row, ["Description"]),
                    "activity_type": _pick(row, ["ActivityGroup", "Type", "Classification"])
                    or "MAIN",
                    "source_date": _pick(row, ["StartDate", "Date"]),
                }
                if activity:
                    for key, value in values.items():
                        setattr(activity, key, value)
                else:
                    self.db.add(Activity(**keys, **values))
                stats["activity"] += 1

    def _upsert_codes(self, rows: list[dict], stats: dict) -> None:
        for row in rows:
            keys = {
                "category": _pick(row, ["Category", "Namespace", "CodeType"]) or "unknown",
                "code": _pick(row, ["Code", "Value"]) or "",
                "language": _pick(row, ["Language"]) or "",
            }
            if not keys["code"]:
                continue
            description = _pick(row, ["Description", "Label"]) or ""
            obj = self.db.query(CodeReference).filter_by(**keys).one_or_none()
            if obj:
                obj.description = description
            else:
                self.db.add(CodeReference(**keys, description=description))
            stats["code"] += 1

    def _upsert_branches(self, rows: list[dict], stats: dict) -> None:
        for row in rows:
            number = _norm_number(_pick(row, ["BranchNumber", "EntityNumber"]))
            enterprise = _norm_number(_pick(row, ["EnterpriseNumber"]))
            if not number or not enterprise:
                continue
            obj = self.db.query(Branch).filter_by(branch_number=number).one_or_none()
            values = {
                "enterprise_number": enterprise,
                "start_date": _pick(row, ["StartDate"]),
            }
            if obj:
                for key, value in values.items():
                    setattr(obj, key, value)
            else:
                self.db.add(Branch(branch_number=number, **values))
            stats["branch"] += 1

    def _source(self, entity_type: str, identifier: str, row: dict, audit_id: int) -> None:
        checksum = _checksum(row)
        exists = self.db.query(SourceRecord).filter_by(
            source_name="kbo",
            source_identifier=identifier,
            entity_type=entity_type,
            checksum=checksum,
        ).first()
        if not exists:
            self.db.add(
                SourceRecord(
                    source_name="kbo",
                    source_identifier=identifier,
                    entity_type=entity_type,
                    raw_payload=dict(row),
                    checksum=checksum,
                    import_audit_id=audit_id,
                )
            )
