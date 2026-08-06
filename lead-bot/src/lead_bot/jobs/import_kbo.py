from __future__ import annotations

import argparse

from lead_bot.config import get_settings
from lead_bot.db import init_db, session_scope
from lead_bot.providers.kbo import KboZipProvider


def main() -> None:
    parser = argparse.ArgumentParser(description="Import CBE/KBO Open Data ZIP or folder")
    parser.add_argument("--path", required=True, help="Path to ZIP or CSV folder")
    parser.add_argument(
        "--region",
        default=None,
        help="Territory key (default from env TERRITORY)",
    )
    parser.add_argument(
        "--type",
        choices=["full", "daily"],
        default=None,
        help="Override archive type inferred from metadata/name",
    )
    args = parser.parse_args()
    settings = get_settings()
    territory = args.region or settings.territory
    init_db()
    with session_scope() as db:
        stats = KboZipProvider(db).import_archive(args.path, territory, args.type)
    print(stats)


if __name__ == "__main__":
    main()
