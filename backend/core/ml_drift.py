


import numpy as np

EPS = 1e-6

def extract_numeric(summary: dict):
    if not summary or "numeric" not in summary:
        return {}

    out = {}
    for col, v in summary["numeric"].items():
        mean = v.get("mean")
        std = v.get("std")
        if mean is not None and std is not None:
            out[col] = (float(mean), float(std))
    return out


def compute_drift_score(old_summary: dict, new_summary: dict) -> float:
    old_vals = extract_numeric(old_summary)
    new_vals = extract_numeric(new_summary)

    if not old_vals or not new_vals:
        return 0.0

    common_cols = set(old_vals.keys()) & set(new_vals.keys())
    if not common_cols:
        return 0.0

    scores = []

    for col in common_cols:
        old_mean, old_std = old_vals[col]
        new_mean, new_std = new_vals[col]

        denom = max(old_std, new_std, EPS)

        mean_shift = abs(old_mean - new_mean) / denom
        std_shift = abs(old_std - new_std) / denom

        raw = (mean_shift + std_shift) / 2

        # squash into [0,1] smoothly
        normalized = 1 - np.exp(-raw)

        scores.append(normalized)

    return round(float(np.mean(scores)), 4)
