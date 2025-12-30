def detect_semantic_drift(old: dict, new: dict, threshold=0.5) -> list:
    drift = []

    for col, new_info in new["columns"].items():
        if col not in old["columns"]:
            continue

        old_info = old["columns"][col]

        # Only for categorical/text columns
        if new_info["top_values"] and old_info["top_values"]:
            old_keys = set(old_info["top_values"].keys())
            new_keys = set(new_info["top_values"].keys())

            jaccard = len(old_keys & new_keys) / max(1, len(old_keys | new_keys))

            if jaccard < threshold:
                drift.append(f"Semantic drift in '{col}' (value meaning changed)")

    return drift
