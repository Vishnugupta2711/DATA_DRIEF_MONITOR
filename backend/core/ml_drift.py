import numpy as np

def extract_numeric(summary: dict):
    if not summary or "numeric" not in summary:
        return []

    out = []
    for col, v in summary["numeric"].items():
        mean = v.get("mean")
        std = v.get("std")
        print(f"[extract_numeric] {col}: mean={mean}, std={std}")
        if mean is not None:
            out.append((mean, std))
    return out


def compute_drift_score(old_summary: dict, new_summary: dict) -> float:
    print("\n====== DRIFT SCORE DEBUG ======")
    print("OLD SUMMARY numeric:", old_summary.get("numeric"))
    print("NEW SUMMARY numeric:", new_summary.get("numeric"))

    old_vals = extract_numeric(old_summary)
    new_vals = extract_numeric(new_summary)

    print("OLD VALS:", old_vals)
    print("NEW VALS:", new_vals)

    if not old_vals or not new_vals:
        print("❌ No numeric data extracted → returning 0")
        return 0.0

    min_len = min(len(old_vals), len(new_vals))
    old_vals = old_vals[:min_len]
    new_vals = new_vals[:min_len]

    scores = []
    for (old_mean, old_std), (new_mean, _) in zip(old_vals, new_vals):
        if not old_std or old_std == 0:
            print("⚠️ std is zero or missing, skipping column")
            continue

        z = abs(old_mean - new_mean) / old_std
        print(f"Z-score = |{old_mean} - {new_mean}| / {old_std} = {z}")
        scores.append(z)

    if not scores:
        print("❌ No valid z-scores → returning 0")
        return 0.0

    score = float(np.mean(scores))
    print("FINAL SCORE:", score)
    print("===============================\n")

    return round(score, 4)
