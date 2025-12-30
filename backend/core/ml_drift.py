from sklearn.ensemble import IsolationForest
import numpy as np

def compute_drift_score(old_summary, new_summary):
    old_vals = []
    new_vals = []

    for col in old_summary["columns"]:
        if col in new_summary["columns"] and "mean" in old_summary["columns"][col]:
            old_vals.append(old_summary["columns"][col]["mean"])
            new_vals.append(new_summary["columns"][col]["mean"])

    if not old_vals:
        return 0.0

    X = np.abs(np.array(old_vals) - np.array(new_vals)).reshape(-1, 1)
    model = IsolationForest(contamination=0.2)
    model.fit(X)
    score = -model.score_samples(X).mean()

    return float(score)
