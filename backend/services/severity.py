def classify_severity(score):
    if score > 0.8:
        return "high"
    if score > 0.4:
        return "medium"
    return "low"
