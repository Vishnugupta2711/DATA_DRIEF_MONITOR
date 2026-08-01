import sys, os
sys.path.append(os.path.abspath("."))

from backend.core.analyzer import analyze_csv
from backend.storage.snapshot_store import save_snapshot, list_snapshots


summary = analyze_csv("data/raw/sales_day1.csv")
path = save_snapshot(summary)

print("Saved snapshot:", path)
print("All snapshots:", list_snapshots())
