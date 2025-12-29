# backend/storage/snapshot_store.py

import json
import os
from datetime import datetime


SNAPSHOT_DIR = "snapshots"


def save_snapshot(summary: dict) -> str:
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    path = os.path.join(SNAPSHOT_DIR, f"{timestamp}.json")

    with open(path, "w") as f:
        json.dump(summary, f, indent=2)

    return path


def load_snapshot(path: str) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def list_snapshots() -> list:
    if not os.path.exists(SNAPSHOT_DIR):
        return []
    return sorted(os.listdir(SNAPSHOT_DIR))
