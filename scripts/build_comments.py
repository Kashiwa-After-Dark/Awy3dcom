from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent
SOURCE = PROJECT_DIR.parent / "柏駅夜間人流_20260707_統合.csv"
OUTPUT = PROJECT_DIR / "public" / "comments.json"

ROUTES = {
    "Nakamura": "レイソルロード",
    "Omori": "レイソルロード",
    "Okazaki": "レイソルロード",
    "SatoSora": "レイソルロード",
    "Tomoya": "レイソルロード",
    "Yoh": "レイソルロード",
    "takahashi": "テラス",
    "Hayato": "テラス",
    "KatayamaTakumi": "テラス",
    "Senri": "テラス",
    "Kobayashi": "テラス",
}


def main() -> None:
    comments = []
    with SOURCE.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["point_type"] != "waypoint":
                continue
            title = row["title_raw"].strip()
            description = row["description_raw"].strip()
            if not title and not description:
                continue
            observer = row["observer"]
            time_jst = row["time_jst"]
            hour = datetime.fromisoformat(time_jst).hour if time_jst else None
            comments.append(
                {
                    "id": f"comment-{len(comments) + 1:04d}",
                    "route": ROUTES.get(observer, "未分類"),
                    "observer": observer,
                    "time": time_jst,
                    "hour": hour,
                    "title": title,
                    "description": description,
                    "latitude": float(row["latitude"]),
                    "longitude": float(row["longitude"]),
                    "sourceFile": row["source_file"],
                }
            )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(comments, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(comments)} comments -> {OUTPUT}")


if __name__ == "__main__":
    main()
