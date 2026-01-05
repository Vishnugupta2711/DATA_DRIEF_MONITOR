def classify_severity(score: float) -> str:
    if score < 0.2:
        return "low"
    elif score < 0.4:
        return "medium"
    else:
        return "high"
