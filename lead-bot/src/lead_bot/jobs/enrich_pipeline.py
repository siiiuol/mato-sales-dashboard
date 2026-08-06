from __future__ import annotations

import argparse

from lead_bot.db import SessionLocal, init_db
from lead_bot.models import Establishment
from lead_bot.services.enrichment import enrich_establishment


def main() -> None:
    parser = argparse.ArgumentParser(description="Run enrichment pipeline")
    parser.add_argument("--min-preliminary", type=float, default=30)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--establishment-id", type=int, default=None)
    args = parser.parse_args()
    init_db()
    db = SessionLocal()
    try:
        if args.establishment_id:
            print(enrich_establishment(db, args.establishment_id))
            return
        rows = (
            db.query(Establishment)
            .filter(Establishment.preliminary_score >= args.min_preliminary)
            .order_by(Establishment.preliminary_score.desc())
            .limit(args.limit)
            .all()
        )
        for est in rows:
            result = enrich_establishment(db, est.id)
            print(est.id, est.name, result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
