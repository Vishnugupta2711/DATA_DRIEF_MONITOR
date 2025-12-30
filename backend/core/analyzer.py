# backend/core/analyzer.py
import pandas as pd

def analyze_csv(path: str) -> dict:
    df = pd.read_csv(path)

    summary = {
        "row_count": len(df),
        "columns": {}
    }

    for col in df.columns:
        series = df[col]

        col_info = {
            "dtype": str(series.dtype),
            "missing_pct": float(series.isna().mean()),
            "unique_count": int(series.nunique())
        }

        if pd.api.types.is_numeric_dtype(series):
            col_info["mean"] = float(series.mean())
            col_info["std"] = float(series.std())
            col_info["min"] = float(series.min())
            col_info["max"] = float(series.max())
            col_info["top_values"] = None
        else:
            # Capture top 5 frequent values for semantic comparison
            top_vals = series.value_counts().head(5).to_dict()
            col_info["top_values"] = top_vals
            col_info["mean"] = None
            col_info["std"] = None
            col_info["min"] = None
            col_info["max"] = None

        summary["columns"][col] = col_info

    return summary
