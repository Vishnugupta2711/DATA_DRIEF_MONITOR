# backend/core/drift.py

from scipy.stats import ks_2samp
from backend.nlp.semantic_engine import semantic_drift_score, generate_drift_summary

def detect_numeric_drift(old_col: dict, new_col: dict, threshold=0.1) -> bool:
    if old_col["mean"] is None or new_col["mean"] is None:
        return False

    old_mean = old_col["mean"]
    new_mean = new_col["mean"]

    if old_mean == 0:
        return False

    relative_change = abs(new_mean - old_mean) / abs(old_mean)
    return relative_change > threshold


def detect_schema_drift(old: dict, new: dict) -> list:
    drift = []

    for col in new["columns"]:
        if col not in old["columns"]:
            drift.append(f"New column: {col}")

    for col in old["columns"]:
        if col not in new["columns"]:
            drift.append(f"Removed column: {col}")

    return drift


def detect_statistical_drift(old: dict, new: dict) -> list:
    drift = []

    for col, new_info in new["columns"].items():
        if col not in old["columns"]:
            continue

        old_info = old["columns"][col]

        if detect_numeric_drift(old_info, new_info):
            drift.append(f"Numeric drift detected in {col}")

        if abs(new_info["missing_pct"] - old_info["missing_pct"]) > 0.2:
            drift.append(f"Missing rate drift in {col}")

    return drift



def detect_semantic_drift(old_summary, new_summary):
    old_text = old_summary.get("text_sample", [])
    new_text = new_summary.get("text_sample", [])

    if not old_text or not new_text:
        return [], None

    score = semantic_drift_score(old_text, new_text)

    explanation = generate_drift_summary(old_text, new_text) if score > 0.25 else None

    drift = []
    if score > 0.4:
        drift.append("Significant semantic shift in textual features")

    return drift, explanation, score