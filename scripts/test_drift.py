from backend.core.analyzer import analyze_csv
from backend.storage.snapshot_store import save_snapshot, load_snapshot, list_snapshots
from backend.core.drift import detect_schema_drift, detect_statistical_drift

s1 = analyze_csv("data/raw/sales_day1.csv")
save_snapshot(s1)

s2 = analyze_csv("data/raw/sales_day2 copy.csv")
save_snapshot(s2)

files = list_snapshots()
old = load_snapshot(f"snapshots/{files[-2]}")
new = load_snapshot(f"snapshots/{files[-1]}")

print("Schema drift:", detect_schema_drift(old, new))
print("Statistical drift:", detect_statistical_drift(old, new))
