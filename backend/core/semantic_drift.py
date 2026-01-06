# backend/core/semantic_drift.py

from difflib import SequenceMatcher


def string_similarity(a: str, b: str) -> float:
    """Compute similarity between two strings."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def detect_semantic_drift(old_summary: dict, new_summary: dict):
    """
    Returns:
        semantic_drift: List[dict]
        explanation: Dict[str, str]
        semantic_score: float
    """

    # Safety fallback
    if not old_summary or not new_summary:
        return [], {}, 0.0

    old_cols = old_summary.get("columns", {})
    new_cols = new_summary.get("columns", {})

    semantic_drift = []
    explanation = {}
    total_score = 0.0
    count = 0

    try:
        for old_col, old_stats in old_cols.items():
            best_match = None
            best_sim = 0.0

            # Try to find best matching column in new dataset
            for new_col in new_cols.keys():
                sim = string_similarity(old_col, new_col)
                if sim > best_sim:
                    best_sim = sim
                    best_match = new_col

            # If similarity is low → semantic rename drift
            if best_sim < 0.6:
                semantic_drift.append({
                    "type": "column_renamed_or_missing",
                    "old_column": old_col,
                    "best_match": best_match,
                    "similarity": round(best_sim, 3)
                })
                explanation[old_col] = f"Column '{old_col}' missing or renamed (best match: '{best_match}', sim={best_sim:.2f})"
                total_score += 1.0
                count += 1
                continue

            new_stats = new_cols.get(best_match, {})

            # Type change detection
            old_type = old_stats.get("dtype")
            new_type = new_stats.get("dtype")
            if old_type != new_type:
                semantic_drift.append({
                    "type": "type_changed",
                    "column": old_col,
                    "old_type": old_type,
                    "new_type": new_type,
                })
                explanation[old_col] = f"Type changed from {old_type} → {new_type}"
                total_score += 0.7
                count += 1

            # Categorical value drift
            old_top = old_stats.get("top_values")
            new_top = new_stats.get("top_values")

            if old_top and new_top:
                old_set = set(old_top.keys())
                new_set = set(new_top.keys())

                jaccard = len(old_set & new_set) / max(len(old_set | new_set), 1)

                if jaccard < 0.5:
                    semantic_drift.append({
                        "type": "categorical_shift",
                        "column": old_col,
                        "jaccard_similarity": round(jaccard, 3),
                    })
                    explanation[old_col] = f"Top categorical values changed significantly (Jaccard={jaccard:.2f})"
                    total_score += (1 - jaccard)
                    count += 1

        semantic_score = round(total_score / max(count, 1), 4)

        return semantic_drift, explanation, semantic_score

    except Exception as e:
        print("Semantic drift error:", e)
        return [], {}, 0.0
