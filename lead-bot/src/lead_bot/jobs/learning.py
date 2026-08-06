from __future__ import annotations

import argparse
import json

from lead_bot.db import SessionLocal, init_db
from lead_bot.services.learning import (
    audit_export,
    evaluate_shadow,
    learning_report,
    promote_rule_version,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="MATO learning operations")
    parser.add_argument("command", choices=["evaluate", "report", "promote", "audit-export"])
    parser.add_argument("--cohort", default="all")
    parser.add_argument("--version")
    parser.add_argument("--actor", default="cli-admin")
    args = parser.parse_args()
    init_db()
    db = SessionLocal()
    try:
        if args.command == "evaluate":
            result = evaluate_shadow(db, args.cohort)
        elif args.command == "report":
            result = learning_report(db, args.cohort)
        elif args.command == "promote":
            if not args.version:
                parser.error("--version is required for promote")
            row = promote_rule_version(db, args.version, args.actor)
            result = {"version": row.version, "status": row.status}
        else:
            result = audit_export(db)
        print(json.dumps(result, indent=2, default=str))
    finally:
        db.close()


if __name__ == "__main__":
    main()
