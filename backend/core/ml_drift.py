from sklearn.ensemble import IsolationForest
import numpy as np


def extract_numeric(summary: dict):
    """Extract numeric column means from summary."""
    if not summary or "numeric" not in summary:
        return []

    return [v["mean"] for v in summary["numeric"].values() if v.get("mean") is not None]


def compute_drift_score(old_summary: dict, new_summary: dict) -> float:
    old_vals = extract_numeric(old_summary)
    new_vals = extract_numeric(new_summary)

    if not old_vals or not new_vals:
        return 0.0  # No numeric data → no drift score

    min_len = min(len(old_vals), len(new_vals))
    old_vals = np.array(old_vals[:min_len])
    new_vals = np.array(new_vals[:min_len])

    diff = np.abs(old_vals - new_vals)
    score = float(np.mean(diff))

    return round(score, 4)
